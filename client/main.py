#!/usr/bin/env python3
"""
agent-orchestrator — CLI entry point

Usage:
    python main.py plans/my-plan.json
    python main.py plans/my-plan.json --dry-run
    python main.py --daemon --server http://localhost:3001 --token YOUR_TOKEN
"""

import argparse
import asyncio
import os
import signal
import socket
import sys

import anyio

from orchestrator import logger
from orchestrator.plan import load_plan, Plan, Task
from orchestrator.runner import run_plan


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Agent Orchestrator — run multi-agent plans via Claude Agent SDK"
    )
    parser.add_argument(
        "plan",
        nargs="?",
        help="Path to the plan JSON file (required unless --daemon is used)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and show the execution plan without running agents",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run in daemon mode: poll API for plans and execute them",
    )
    parser.add_argument(
        "--server",
        help="API server URL (default: from AGENTS_MANAGER_URL env var or http://localhost:3001)",
    )
    parser.add_argument(
        "--token",
        help="Bearer token for authentication (default: from AGENTS_MANAGER_TOKEN env var)",
    )
    return parser.parse_args()


def dry_run(plan_path: str) -> None:
    plan = load_plan(plan_path)
    logger.header(f"Dry run: {plan.name}")
    waves = plan.execution_order()
    for i, wave in enumerate(waves):
        print(f"  Wave {i + 1}:")
        for task in wave:
            deps = f"  (depends on: {', '.join(task.depends_on)})" if task.depends_on else ""
            print(f"    [{task.id}] {task.name}{deps}")
            print(f"         cwd: {task.cwd}")
            print(f"         tools: {task.tools}")


async def run_daemon(server_url: str, token: str) -> None:
    """
    Run in daemon mode: poll API for plans and chat sessions to execute.

    Args:
        server_url: Base URL of the API server
        token: Bearer token for authentication
    """
    from orchestrator.daemon_client import DaemonClient

    client = DaemonClient(server_url, token)
    shutdown_requested = False

    def signal_handler(signum, frame):
        nonlocal shutdown_requested
        logger.info(f"Received signal {signum}, shutting down after current tasks...")
        shutdown_requested = True

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info(f"Daemon started - polling {server_url} for plans and chat sessions")
    logger.info(f"Client ID: {socket.gethostname()}")

    # Track running sessions to avoid processing the same session multiple times
    running_sessions: set[str] = set()

    try:
        while not shutdown_requested:
            # Poll for pending plans
            response = client.get_pending_plans()

            if response.error:
                logger.warn(f"Failed to fetch pending plans: {response.error}")
            elif response.data and len(response.data) > 0:
                # Process each pending plan
                for plan_data in response.data:
                    if shutdown_requested:
                        break

                    plan_id = plan_data.get("id")
                    plan_name = plan_data.get("name")
                    tasks_json = plan_data.get("tasks", "[]")

                    # Parse tasks from JSON string
                    import json
                    try:
                        tasks_data = json.loads(tasks_json) if isinstance(tasks_json, str) else tasks_json
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse tasks JSON: {tasks_json}")
                        continue

                    logger.info(f"Received plan: {plan_name} (ID: {plan_id})")

                    # Notify API that we're starting the plan
                    start_response = client.start_plan(plan_id)
                    if start_response.error:
                        logger.error(f"Failed to start plan: {start_response.error}")
                        continue

                    # Convert API plan format to internal Plan format
                    tasks = [
                        Task(
                            id=t["id"],
                            name=t["name"],
                            prompt=t["prompt"],
                            cwd=t.get("cwd", "."),
                            tools=t.get("tools", ["Read", "Write", "Edit", "Bash", "Glob"]),
                            permission_mode=t.get("permission_mode", "acceptEdits"),
                            depends_on=t.get("depends_on", []),
                            max_turns=t.get("max_turns"),
                            system_prompt=t.get("system_prompt"),
                            env=t.get("env", {}),
                            agent_file=t.get("agent_file"),
                            workspace=t.get("workspace") or t.get("workspace_path"),  # Support both for compatibility
                        )
                        for t in tasks_data
                    ]
                    plan = Plan(id=plan_id, name=plan_name, tasks=tasks)

                    # Execute the plan with log collection
                    success, error_msg = await run_plan_with_logging(client, plan_id, plan)

                    # Notify API of completion
                    status = "success" if success else "failed"
                    result = f"Plan {plan_name} completed successfully" if success else f"Plan {plan_name} failed: {error_msg or 'Unknown error'}"
                    complete_response = client.complete_plan(plan_id, status, result)

                    if complete_response.error:
                        logger.error(f"Failed to complete plan: {complete_response.error}")
                    else:
                        logger.info(f"Plan {plan_name} marked as {status}")

            # Poll for pending chat sessions
            sessions_response = client.get_pending_sessions()

            if sessions_response.error:
                logger.warn(f"Failed to fetch pending sessions: {sessions_response.error}")
            elif sessions_response.data and len(sessions_response.data) > 0:
                # Process each pending session
                for session_data in sessions_response.data:
                    if shutdown_requested:
                        break

                    session_id = session_data.get('id')
                    if not session_id:
                        continue

                    # Skip if already processing this session
                    if session_id in running_sessions:
                        continue

                    # Mark as running
                    running_sessions.add(session_id)

                    # Create task to process session asynchronously
                    # Use default argument to capture current session_data value (closure bug fix)
                    async def _run_session(s=session_data):
                        try:
                            await process_chat_session(s, client)
                        finally:
                            running_sessions.discard(s.get('id'))

                    asyncio.create_task(_run_session())

            # Wait before next poll (unless shutting down)
            if not shutdown_requested:
                await asyncio.sleep(5)

    except Exception as e:
        logger.error(f"Daemon error: {e}")
    finally:
        client.close()
        logger.info("Daemon stopped")


async def run_plan_with_logging(
    client: object,  # DaemonClient - avoid circular import
    plan_id: str,
    plan: Plan,
) -> tuple[bool, str | None]:
    """
    Execute a plan and stream logs to the API.

    This wraps run_plan() but captures log output and sends it to the API.

    Args:
        client: Daemon API client
        plan_id: Plan ID for log submission
        plan: Plan to execute

    Returns:
        Tuple of (success: bool, error_message: str | None)
    """
    from orchestrator.runner import run_plan

    logger.plan_start(plan.name)

    # Buffer logs in memory for batch sending
    logs_buffer: list[dict] = []

    def log_callback(task_id: str, level: str, message: str) -> None:
        """Callback to collect logs from runner."""
        logs_buffer.append({
            "task_id": task_id,
            "level": level,
            "message": message,
        })

        # Send in batch: every 5 logs or on significant events
        if len(logs_buffer) >= 5 or level in ("error", "info"):
            logs_to_send = logs_buffer.copy()
            logs_buffer.clear()
            log_response = client.send_logs(plan_id, logs_to_send)
            if log_response.error:
                logger.error(f"Failed to send logs: {log_response.error}")

    try:
        # Execute plan with log callback
        success = await run_plan(plan, log_callback, client)

        # Flush any remaining logs
        if logs_buffer:
            log_response = client.send_logs(plan_id, logs_buffer)
            if log_response.error:
                logger.error(f"Failed to send logs: {log_response.error}")

        logger.plan_done(plan.name, success=success)
        return success, None

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Plan execution error: {error_msg}")

        # Flush logs on error
        if logs_buffer:
            log_response = client.send_logs(plan_id, logs_buffer)
            if log_response.error:
                logger.error(f"Failed to send logs: {log_response.error}")

        # Notify API of failure
        client.complete_plan(plan_id, 'failed', error_msg)
        return False, error_msg


async def process_chat_session(session: dict, client: object) -> None:
    """
    Process a chat session from the daemon.

    Executes a single turn of the conversation and saves the assistant's response.

    Args:
        session: Session data from the API
        client: Daemon API client
    """
    from orchestrator.chat_runner import run_chat_turn

    session_id = session['id']
    workspace_path = session['workspace_path']

    # Use env_project_path if available (from environment), otherwise fall back to workspace_path
    cwd = session.get('env_project_path') or session.get('cwd') or workspace_path

    sdk_session_id = session.get('sdk_session_id')
    user_message = session.get('last_user_message', '')

    logger.info(f'Processing chat session {session_id[:8]}...')

    async def on_sdk_session(new_id: str):
        """Callback when SDK session ID changes."""
        response = client.save_sdk_session_id(session_id, new_id)
        if response.error:
            logger.error(f'Failed to save SDK session ID: {response.error}')
        else:
            logger.debug(f'Session {session_id[:8]} sdk_id: {new_id[:8]}...')

    async def on_response(text: str, structured):
        """Callback when assistant response is complete."""
        response = client.save_assistant_message(session_id, text, structured)
        if response.error:
            logger.error(f'Failed to save assistant message: {response.error}')

    async def log_callback(logs: list):
        """Callback for streaming logs."""
        # We don't need to stream logs separately for chat
        # The full response is saved via on_response
        pass

    # Check if user message exists
    if not user_message:
        logger.warning(f'Session {session_id[:8]} has no user message, skipping')
        # Reset to idle to avoid getting stuck
        await on_response('No message received.', None)
        return

    try:
        new_sdk_session_id = await run_chat_turn(
            session_id=session_id,
            message=user_message,
            workspace_path=workspace_path,
            cwd=cwd,
            sdk_session_id=sdk_session_id,
            on_sdk_session=on_sdk_session,
            on_response=on_response,
            log_callback=log_callback,
        )

        logger.info(f'Session {session_id[:8]} completed')
    except Exception as e:
        logger.error(f'Chat session {session_id[:8]} error: {e}')
        # Save error as assistant message
        await on_response(f'Error: {str(e)}', None)


async def main() -> None:
    args = parse_args()

    # Daemon mode
    if args.daemon:
        # Get server URL from CLI flag, env var, or default
        server_url = args.server or os.environ.get(
            "AGENTS_MANAGER_URL", "http://localhost:3001"
        )

        # Get token from CLI flag or env var
        token = args.token or os.environ.get("AGENTS_MANAGER_TOKEN")

        if not token:
            logger.error(
                "Token is required for daemon mode. "
                "Use --token or set AGENTS_MANAGER_TOKEN environment variable."
            )
            sys.exit(1)

        await run_daemon(server_url, token)
        return

    # Standard mode: require plan file
    if not args.plan:
        logger.error("Plan file is required unless using --daemon mode")
        sys.exit(1)

    try:
        plan = load_plan(args.plan)
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to load plan: {e}")
        sys.exit(1)

    if args.dry_run:
        dry_run(args.plan)
        return

    success = await run_plan(plan)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
"""
Runner: executes tasks from a Plan using the Claude Agent SDK.

Supports:
- Sequential and parallel task execution (via dependency waves)
- Per-task cwd, tools, system_prompt, env
- Automatic permission approval (permission_mode=acceptEdits)
- ANTHROPIC_BASE_URL passthrough (llm-router integration)
- Context passing between dependent tasks
- Live streaming output to terminal

Notes:
- Uses anyio (not asyncio) to avoid cancel scope conflicts with the SDK
- Parallel tasks within a wave run sequentially (SDK anyio limitation)
- cwd is injected into the prompt so Claude respects the working directory
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

import anyio

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    query,
)

from orchestrator import logger
from orchestrator.plan import Plan, Task


# Structured output patterns for quick actions
STRUCTURED_PATTERNS = [
    ('plan', r'<plan>\s*({.*?})\s*</plan>'),
    ('review', r'<review>\s*({.*?})\s*</review>'),
    ('diagnosis', r'<diagnosis>\s*({.*?})\s*</diagnosis>'),
]


def extract_structured_output(full_text: str) -> dict | None:
    """
    Extract the last structured output block found in the agent output.

    Searches for JSON blocks wrapped in <plan>, <review>, or <diagnosis> tags.
    These are used by quick actions to produce structured results for frontend approval.

    Uses the LAST occurrence of each pattern type to avoid capturing template examples
    from skill definitions (e.g., planner skill contains an example <plan> block before
    the actual generated plan).

    Args:
        full_text: Complete output text from the agent execution

    Returns:
        dict with 'type' (plan|review|diagnosis) and 'content' (parsed JSON),
        or None if no structured output found
    """
    for output_type, pattern in STRUCTURED_PATTERNS:
        # Find all matches and use the last one (not the first)
        matches = list(re.finditer(pattern, full_text, re.DOTALL))
        if matches:
            # Use the last match — the real generated plan, not template examples
            last_match = matches[-1]
            try:
                content = json.loads(last_match.group(1))
                return {'type': output_type, 'content': content}
            except json.JSONDecodeError:
                # Pattern matched but JSON is invalid - continue to next pattern
                continue
    return None


def _check_deny_rules(tool_name: str, tool_input: dict, deny_rules: list[str]) -> tuple[bool, str]:
    """
    Check if a tool operation matches any deny rule.

    Args:
        tool_name: Name of the tool being used
        tool_input: Input parameters for the tool
        deny_rules: List of deny rules from settings.local.json

    Returns:
        Tuple of (needs_approval, matched_rule)
    """
    for rule in deny_rules:
        # Exact match: "Bash" or "Write"
        if rule == tool_name:
            return True, rule

        # Pattern match: "Bash(rm -rf *)" or "Write(/etc/*)"
        if rule.startswith(f"{tool_name}("):
            # Extract pattern between parentheses
            pattern = rule[len(tool_name) + 1:-1]

            # Check if pattern matches input
            input_str = str(tool_input)

            # Simple wildcard matching
            if "*" in pattern:
                # Convert glob pattern to simple substring check
                base_pattern = pattern.replace("*", "").strip()
                if base_pattern and base_pattern in input_str:
                    return True, rule
            elif pattern in input_str:
                return True, rule

    return False, ""


def _load_deny_rules(workspace: str | None, cwd: str) -> list[str]:
    """
    Load deny rules from workspace/.claude/settings.local.json.

    Args:
        workspace: Agent workspace directory
        cwd: Task working directory

    Returns:
        List of deny rules (empty list if no rules found)
    """
    # Prefer workspace, fall back to cwd
    settings_base = workspace if workspace else cwd
    settings_path = Path(settings_base) / ".claude" / "settings.local.json"

    if not settings_path.exists():
        return []

    try:
        data = json.loads(settings_path.read_text(encoding="utf-8"))
        return data.get("permissions", {}).get("deny", [])
    except Exception as e:
        logger.warn(f"Could not load deny rules from {settings_path}: {e}")
        return []


# Directory for storing context notes between tasks
CONTEXT_DIR = Path('/tmp/agent-client-context')


@dataclass
class TaskResult:
    task_id: str
    success: bool
    output: str = ""          # Captured ResultMessage.result — passed as context to dependents
    error: str | None = None


def _init_context_dir(plan_name: str) -> Path:
    """
    Create and return the context directory for a plan.

    Args:
        plan_name: Name of the plan (used to create a unique subdirectory)

    Returns:
        Path to the context directory
    """
    ctx_dir = CONTEXT_DIR / plan_name.replace(' ', '_')
    ctx_dir.mkdir(parents=True, exist_ok=True)
    return ctx_dir


def _save_task_note(ctx_dir: Path, task: Task, result_text: str) -> None:
    """
    Save a task result as a markdown note in the context directory.

    Args:
        ctx_dir: Context directory for this plan
        task: The task that was executed
        result_text: The output/result from the task
    """
    note_path = ctx_dir / f'{task.id}.md'
    note = f"""# Task: {task.name} (ID: {task.id})
## Status: success

## Summary
{result_text[:2000] if result_text else 'No output'}
"""
    note_path.write_text(note)


def _load_dependency_context(task: Task, ctx_dir: Path) -> str:
    """
    Load context notes from all dependency tasks.

    Args:
        task: The task whose dependencies should be loaded
        ctx_dir: Context directory for this plan

    Returns:
        Formatted context string with all dependency notes
    """
    if not task.depends_on:
        return ""

    context_sections = []
    for dep_id in task.depends_on:
        note_path = ctx_dir / f'{dep_id}.md'
        if note_path.exists():
            context_sections.append(note_path.read_text())

    if not context_sections:
        return ""

    context_block = '\n---\n'.join(context_sections)
    return f"""## Context from previous tasks

{context_block}

---

"""


def _apply_workspace_env(workspace: str | None, cwd: str) -> None:
    """
    Read env vars from workspace/.claude/settings.local.json and apply them to os.environ.

    The Claude Agent SDK resolves authentication BEFORE loading project settings,
    so env vars declared in settings.local.json arrive too late to affect auth.
    We apply them here, before the SDK is even instantiated.

    workspace (agent-coder dir) has precedence over cwd (agent working dir):
    - workspace = where CLAUDE.md and .claude/settings.local.json live
                 (e.g., /root/projects/agent-client-working/projects/agents-manager/agent-coder)
    - cwd = where the agent works (e.g., /tmp, /root/projects/test_web)

    Shell environment always wins: we only set a var if it is not already set.
    """
    # Use workspace if available, otherwise fall back to cwd
    settings_base = workspace if workspace else cwd
    settings_path = Path(settings_base) / ".claude" / "settings.local.json"

    if not settings_path.exists():
        # If workspace was specified but didn't work, try cwd as fallback
        if workspace:
            fallback_path = Path(cwd) / ".claude" / "settings.local.json"
            if fallback_path.exists():
                settings_path = fallback_path
            else:
                logger.warn(
                    f"⚠ No settings.local.json found at {settings_path} or {fallback_path}\n"
                    f"  → Agent will use default OAuth auth (may expire)\n"
                    f"  → Create workspace via /agents page with proper ANTHROPIC_BASE_URL"
                )
                return
        else:
            # No workspace specified, and cwd doesn't have settings
            logger.warn(
                f"⚠ No settings.local.json found at {settings_path}\n"
                f"  → Agent will use default OAuth auth (may expire)\n"
                f"  → Create workspace via /agents page or run: claude login"
            )
            return

    try:
        data = json.loads(settings_path.read_text(encoding="utf-8"))
        env_vars: dict[str, str] = data.get("env", {})
        for key, value in env_vars.items():
            if key not in os.environ:
                os.environ[key] = str(value)
                logger.info(f"  env from settings.local.json ({settings_base}): {key}={value}")
    except Exception as e:
        logger.warn(f"Could not read {settings_path}: {e}")


def build_system_prompt(task: Task) -> str | None:
    """
    Build the system prompt for a task.
    Priority: agent_file > system_prompt field.
    If both exist, agent_file wins (it's the authoritative identity file).
    """
    if task.agent_file:
        content = _read_file(task.agent_file, "agent_file")
        if content:
            return content
    return task.system_prompt


def build_prompt(task: Task, context: dict[str, TaskResult], ctx_dir: Path | None = None) -> str:
    """
    Build the final prompt for a task, injecting:
    1. Environment context (if available from selected environment)
    2. Working directory (so Claude doesn't create files in /tmp)
    3. Context from upstream tasks (from saved notes if ctx_dir provided, otherwise from memory)
    4. The task prompt itself

    Skills and sub-agents are NOT injected here.
    They live natively in the project under:
      <cwd>/.claude/skills/<skill-name>/SKILL.md   — discovered via frontmatter, loaded on demand
      <cwd>/.claude/agents/<agent-name>.md          — invoked by the parent agent via Task tool

    The SDK uses the same agent loop as Claude Code CLI and picks these up automatically
    when cwd is set correctly. Only the frontmatter (name + description) is loaded at
    startup. Full content is read only when Claude decides to invoke a skill.

    Args:
        task: Task to build prompt for
        context: Results from previous tasks (used as fallback if no ctx_dir)
        ctx_dir: Context directory with saved dependency notes (takes precedence)
    """
    parts: list[str] = []

    # 1. Inject environment context if available (from selected environment in the form)
    if task.env_context:
        parts.append(f"[Environment: {task.env_context}]")
        parts.append("")

    # 2. Inject cwd explicitly — critical: without this Claude ignores the cwd option
    parts.append(f"Working directory: {task.cwd}")
    parts.append(f"All files must be created inside {task.cwd}. Do not use /tmp or any other path.\n")

    # 3. Context from upstream tasks
    # Prefer saved notes from disk if available (richer context), otherwise fall back to memory
    if ctx_dir:
        dependency_context = _load_dependency_context(task, ctx_dir)
        if dependency_context:
            parts.append(dependency_context)
    else:
        # Fallback to in-memory context (backward compatibility)
        upstream = [context[dep] for dep in task.depends_on if dep in context]
        if upstream:
            parts.append("## Context from previous tasks")
            for r in upstream:
                parts.append(f"### [{r.task_id}]\n{r.output}\n")
            parts.append("")

    # 4. Task instructions
    parts.append("## Your task")
    parts.append(task.prompt)

    return "\n".join(parts)


async def should_skip_task(task_id: str, plan_id: str, client: Any) -> bool:
    """
    Check if a task has already been completed successfully.

    Args:
        task_id: ID of the task to check
        plan_id: ID of the plan
        client: DaemonClient instance for fetching logs

    Returns:
        True if the task was already completed successfully, False otherwise
    """
    try:
        logs_response = await client.get_plan_logs(plan_id)
        if logs_response.error:
            logger.warn(f"Failed to fetch logs for resume check: {logs_response.error}")
            return False

        logs = logs_response.data or []

        # Check for successful task completion indicators:
        # 1. Logs with level='success' for this task_id
        # 2. Logs with message starting with 'Task completed' or '✔ finished' for this task_id
        for log in logs:
            if log.get('task_id') != task_id:
                continue

            level = log.get('level')
            message = log.get('message', '')

            if level == 'success':
                return True
            if message.startswith('Task completed') or message.startswith('✔ finished'):
                return True

        return False
    except Exception as e:
        logger.warn(f"Error checking if task should be skipped: {e}")
        return False


async def run_task(
    task: Task,
    context: dict[str, TaskResult],
    ctx_dir: Path | None = None,
    log_callback: callable[[str, str, str], None] | None = None,
    client: Any | None = None,  # DaemonClient instance
    plan_id: str | None = None,  # Plan ID for approval requests
) -> TaskResult:
    """
    Run a single task and stream output to terminal.

    Args:
        task: Task to execute
        context: Results from previous tasks
        ctx_dir: Context directory for saving/loading dependency notes
        log_callback: Optional callback(task_id, level, message) for log collection

    Returns:
        TaskResult with success status and output
    """
    # Skip already completed tasks when resuming
    if client and plan_id and await should_skip_task(task.id, plan_id, client):
        logger.info(f"↻ Skipping already completed task: {task.id} ({task.name})")
        if log_callback:
            log_callback(task.id, "info", f"↻ Skipping already completed task: {task.name}")

        # Load the task's output from context note if available
        if ctx_dir:
            note_path = ctx_dir / f'{task.id}.md'
            if note_path.exists():
                note_content = note_path.read_text()
                # Extract the summary section from the note
                lines = note_content.split('\n')
                summary_lines = []
                in_summary = False
                for line in lines:
                    if line.startswith('## Summary'):
                        in_summary = True
                        continue
                    if in_summary:
                        summary_lines.append(line)

                output = '\n'.join(summary_lines).strip()
                return TaskResult(task_id=task.id, success=True, output=output)

        # If no saved context, still mark as success (task was completed before)
        return TaskResult(task_id=task.id, success=True, output="")

    logger.task_start(task.id, task.name, task.cwd)

    # Send initial log message
    if log_callback:
        log_callback(task.id, "info", f"▶ Starting task: {task.name}")

    # Validate cwd exists before attempting to create ClaudeAgentOptions
    if not Path(task.cwd).exists():
        error_msg = f"Workspace directory does not exist: {task.cwd}"
        logger.task_error(task.id, error_msg)
        return TaskResult(task_id=task.id, success=False, error=error_msg)

    # Apply env vars from workspace settings.local.json BEFORE SDK init.
    # The SDK resolves auth on startup — if ANTHROPIC_BASE_URL isn't in os.environ
    # at that point, it falls back to the global ~/.claude OAuth token.
    _apply_workspace_env(task.workspace, task.cwd)

    # Apply any task-level env overrides from the plan (highest priority)
    if task.env:
        os.environ.update(task.env)

    # Ensure "Skill" is in allowed tools so the SDK can invoke skills on demand
    tools = list(task.tools)
    if "Skill" not in tools:
        tools.append("Skill")

    options = ClaudeAgentOptions(
        cwd=task.cwd,
        allowed_tools=tools,
        permission_mode=task.permission_mode,
        max_turns=task.max_turns,
        system_prompt=build_system_prompt(task),
        # "project" loads CLAUDE.md, .claude/skills/, .claude/agents/, .claude/settings*.json
        # from the cwd. Without this, all project-level features are silently ignored.
        setting_sources=["project"],
    )

    prompt = build_prompt(task, context, ctx_dir)

    final_result: ResultMessage | None = None
    logs_buffer: list[dict] = []
    captured_texts: list[str] = []  # Capture all output text for structured output detection

    def send_logs_if_needed() -> None:
        """Send buffered logs if callback is available and buffer has content."""
        if log_callback and logs_buffer:
            for entry in logs_buffer:
                log_callback(entry["task_id"], entry["level"], entry["message"])
            logs_buffer.clear()

    def add_log(level: str, message: str) -> None:
        """Add a log entry to buffer and optionally send immediately."""
        entry = {
            "task_id": task.id,
            "level": level,
            "message": message,
        }
        logs_buffer.append(entry)

        # Send in batch: every 5 logs or immediately if callback prefers
        if log_callback and len(logs_buffer) >= 5:
            send_logs_if_needed()

    try:
        # IMPORTANT: do NOT return or break inside this loop.
        # Exiting early sends GeneratorExit to the SDK generator, which tries to close
        # an anyio cancel scope from a different task — causing RuntimeError.
        # Let the generator finish naturally; ResultMessage is always the last message.
        async for message in query(prompt=prompt, options=options):
            # Debug: log message type for first few messages
            if len(logs_buffer) == 0:
                logger.debug(f"[{task.id}] Message type: {type(message).__name__}, module: {type(message).__module__}")

            # Handle AssistantMessage (contains text and tool use)
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock) and block.text.strip():
                        logger.task_output(task.id, block.text)
                        add_log("info", block.text)
                        captured_texts.append(block.text)  # Capture for structured output
                    elif isinstance(block, ToolUseBlock):
                        logger.task_tool(task.id, block.name)
                        add_log("debug", f"⚙ {block.name}")

                        # Check if this tool requires approval
                        if client and plan_id:
                            deny_rules = _load_deny_rules(task.workspace, task.cwd)
                            needs_approval, matched_rule = _check_deny_rules(
                                block.name, block.input, deny_rules
                            )

                            if needs_approval:
                                logger.warning(
                                    f"[approval] Tool '{block.name}' matches deny rule "
                                    f'"{matched_rule}" — requesting approval'
                                )
                                add_log(
                                    "warning",
                                    f"⚠ Approval required for '{block.name}' "
                                    f"(rule: {matched_rule})",
                                )

                                reason = (
                                    f"Tool `{block.name}` matches deny rule: "
                                    f"`{matched_rule}`"
                                )

                                try:
                                    # Request approval
                                    approval_resp = client.request_approval(
                                        plan_id=plan_id,
                                        task_id=task.id,
                                        tool=block.name,
                                        input_data=block.input,
                                        reason=reason,
                                    )

                                    if approval_resp.error:
                                        error_msg = (
                                            f"Failed to request approval: "
                                            f"{approval_resp.error}"
                                        )
                                        logger.task_error(task.id, error_msg)
                                        add_log("error", error_msg)
                                        # Continue execution - fail-safe behavior

                                    elif approval_resp.data:
                                        approval_id = approval_resp.data.get("id")
                                        logger.info(
                                            f"[approval] Waiting for response "
                                            f"(ID: {approval_id})..."
                                        )
                                        add_log(
                                            "info",
                                            f"⏳ Waiting for approval (ID: {approval_id})...",
                                        )

                                        # Wait for decision
                                        decision_resp = (
                                            await client.wait_for_approval(approval_id)
                                        )

                                        if decision_resp.error:
                                            error_msg = (
                                                f"Approval polling error: "
                                                f"{decision_resp.error}"
                                            )
                                            logger.task_error(task.id, error_msg)
                                            add_log("error", error_msg)
                                            # Continue execution - fail-safe behavior

                                        elif decision_resp.data:
                                            decision = decision_resp.data
                                            logger.info(f"[approval] Decision: {decision}")
                                            add_log("info", f"✅ Approval decision: {decision}")

                                            if decision == "denied":
                                                # Tool use was denied - stop execution
                                                error_msg = (
                                                    f"Tool '{block.name}' was denied approval. "
                                                    f"Task execution stopped."
                                                )
                                                logger.task_error(task.id, error_msg)
                                                add_log("error", f"❌ {error_msg}")
                                                return TaskResult(
                                                    task_id=task.id,
                                                    success=False,
                                                    error=error_msg,
                                                )
                                            elif decision == "timeout":
                                                # Approval timed out
                                                error_msg = (
                                                    f"Tool '{block.name}' approval timed out. "
                                                    f"Task execution stopped."
                                                )
                                                logger.task_error(task.id, error_msg)
                                                add_log("error", f"⏱ {error_msg}")
                                                return TaskResult(
                                                    task_id=task.id,
                                                    success=False,
                                                    error=error_msg,
                                                )
                                            # If 'approved', continue with tool execution

                                except Exception as e:
                                    error_msg = f"Error during approval flow: {e}"
                                    logger.task_error(task.id, error_msg)
                                    add_log("error", error_msg)
                                    # Continue execution - fail-safe behavior

            elif isinstance(message, ResultMessage):
                final_result = message  # store — don't return yet
                add_log("info", f"✔ finished — {message.stop_reason}")
                send_logs_if_needed()  # Flush logs on completion

    except Exception as e:
        error_msg = str(e)
        # Enhance error message for authentication failures
        if '401' in error_msg or 'OAuth' in error_msg or 'authentication' in error_msg.lower():
            friendly_msg = (
                f"❌ Authentication failed: {error_msg}\n"
                f"→ Check that the workspace settings.local.json has ANTHROPIC_BASE_URL "
                f"pointing to the llm-router (http://localhost:8083)\n"
                f"→ Or run: claude login"
            )
            logger.task_error(task.id, friendly_msg)
            add_log("error", friendly_msg)
            send_logs_if_needed()  # Flush logs on error
            return TaskResult(task_id=task.id, success=False, error=friendly_msg)
        # Enhance error message for SDK failures with stderr hints
        if 'Check stderr output for details' in error_msg:
            error_msg = f'Agent execution failed: {error_msg}'
        logger.task_error(task.id, error_msg)
        add_log("error", error_msg)
        send_logs_if_needed()  # Flush logs on error
        return TaskResult(task_id=task.id, success=False, error=error_msg)

    if final_result is not None:
        success = final_result.subtype == "success"
        output = final_result.result or ""
        logger.task_done(task.id, final_result.subtype)
        send_logs_if_needed()  # Flush any remaining logs

        # Save context note for dependent tasks if this task succeeded
        if success and ctx_dir:
            _save_task_note(ctx_dir, task, output)

        # Detect and save structured output for quick actions
        if success and client and plan_id:
            full_output = '\n'.join(captured_texts)
            structured = extract_structured_output(full_output)
            if structured:
                logger.info(f"[{task.id}] Found structured output: {structured['type']}")
                try:
                    await client.save_structured_output(plan_id, structured)
                except Exception as e:
                    logger.warning(f"[{task.id}] Failed to save structured output: {e}")

        return TaskResult(task_id=task.id, success=success, output=output)

    logger.task_done(task.id, "success")
    send_logs_if_needed()  # Flush any remaining logs

    # Save context note for dependent tasks if this task succeeded
    if ctx_dir:
        _save_task_note(ctx_dir, task, "")

    # Detect and save structured output for quick actions (no result case)
    if client and plan_id:
        full_output = '\n'.join(captured_texts)
        structured = extract_structured_output(full_output)
        if structured:
            logger.info(f"[{task.id}] Found structured output: {structured['type']}")
            try:
                await client.save_structured_output(plan_id, structured)
            except Exception as e:
                logger.warning(f"[{task.id}] Failed to save structured output: {e}")

    return TaskResult(task_id=task.id, success=True)


async def run_wave(
    tasks: list[Task],
    context: dict[str, TaskResult],
    ctx_dir: Path | None = None,
    log_callback: callable[[str, str, str], None] | None = None,
    client: Any | None = None,
    plan_id: str | None = None,
) -> list[TaskResult]:
    """
    Run all tasks in a wave.

    NOTE: The Claude Agent SDK uses anyio internally with cancel scopes that are
    not safe to share across tasks. Running tasks sequentially within a wave avoids
    the 'cancel scope in different task' RuntimeError. True parallelism can be
    revisited once the SDK resolves this upstream.

    Args:
        tasks: List of tasks to run
        context: Results from previous tasks
        ctx_dir: Context directory for saving/loading dependency notes
        log_callback: Optional callback(task_id, level, message) for log collection
        client: Optional DaemonClient instance for approval requests
        plan_id: Optional plan ID for approval requests

    Returns:
        List of TaskResult objects
    """
    results: list[TaskResult] = []
    for task in tasks:
        result = await run_task(task, context, ctx_dir, log_callback, client, plan_id)
        results.append(result)
    return results


async def run_plan(
    plan: Plan,
    log_callback: callable[[str, str, str], None] | None = None,
    client: Any | None = None,
) -> bool:
    """
    Execute the full plan in dependency order.

    Args:
        plan: Plan to execute
        log_callback: Optional callback(task_id, level, message) for log collection

    Returns:
        True if all tasks succeeded
    """
    logger.plan_start(plan.name)

    # Initialize context directory for this plan
    ctx_dir = _init_context_dir(plan.name)

    waves = plan.execution_order()
    context: dict[str, TaskResult] = {}  # task_id → result, passed downstream

    for wave_index, wave in enumerate(waves):
        logger.wave_start(wave_index, [t.name for t in wave])
        results = await run_wave(wave, context, ctx_dir, log_callback, client, plan.id)

        for r in results:
            context[r.task_id] = r

        failed = [r for r in results if not r.success]
        if failed:
            for f in failed:
                logger.error(f"Task '{f.task_id}' failed — stopping plan.")
            logger.plan_done(plan.name, success=False)
            return False

    logger.plan_done(plan.name, success=True)
    return True
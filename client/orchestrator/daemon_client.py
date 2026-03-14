"""
DaemonClient: HTTP client for communicating with the agents-manager API.

Handles all HTTP communication for daemon mode:
- Polling for pending plans
- Starting plan execution
- Streaming log entries
- Completing plan execution
- Requesting and waiting for approvals
"""

from __future__ import annotations

import socket
import time
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class Plan:
    """A plan from the API."""
    id: str
    name: str
    tasks: list[dict[str, Any]]
    status: str


@dataclass
class PlanResponse:
    """Response envelope from the API."""
    data: Any | None
    error: str | None = None


class DaemonClient:
    """
    HTTP client for the agents-manager API.

    All methods return PlanResponse with {data, error} envelope.
    """

    def __init__(self, server_url: str, token: str):
        """
        Initialize the client.

        Args:
            server_url: Base URL of the API server (e.g., http://localhost:3001)
            token: Bearer token for authentication
        """
        self.server_url = server_url.rstrip("/")
        self.token = token
        self.client_id = socket.gethostname()
        self._client = httpx.Client(
            base_url=f"{self.server_url}/api",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=30.0,
        )

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def _handle_response(self, response: httpx.Response) -> PlanResponse:
        """
        Handle API response, extracting data/error from envelope.

        Args:
            response: HTTP response from the API

        Returns:
            PlanResponse with data and error fields
        """
        try:
            envelope = response.json()
            if isinstance(envelope, dict):
                return PlanResponse(
                    data=envelope.get("data"),
                    error=envelope.get("error"),
                )
            # Fallback for non-envelope responses (shouldn't happen with proper API)
            return PlanResponse(data=envelope)
        except Exception as e:
            return PlanResponse(
                data=None,
                error=f"Failed to parse response: {e}",
            )

    def get_pending_plans(self) -> PlanResponse:
        """
        Poll for pending plans.

        GET /api/plans/pending

        Returns:
            PlanResponse with data=list[Plan] or error
        """
        try:
            response = self._client.get("/plans/pending")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def start_plan(self, plan_id: str) -> PlanResponse:
        """
        Start execution of a plan.

        POST /api/plans/:id/start
        Body: {client_id: hostname}

        Args:
            plan_id: ID of the plan to start

        Returns:
            PlanResponse with data=updated_plan or error
        """
        try:
            response = self._client.post(
                f"/plans/{plan_id}/start",
                json={"client_id": self.client_id},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def send_logs(self, plan_id: str, logs: list[dict[str, Any]]) -> PlanResponse:
        """
        Send log entries for a plan.

        POST /api/plans/:id/logs
        Body: [{task_id, level, message}, ...]

        Args:
            plan_id: ID of the plan
            logs: List of log entries with task_id, level, message

        Returns:
            PlanResponse with data=success or error
        """
        if not logs:
            return PlanResponse(data=True)

        try:
            response = self._client.post(
                f"/plans/{plan_id}/logs",
                json=logs,  # Send logs array directly, not wrapped in object
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def complete_plan(
        self,
        plan_id: str,
        status: str,
        result: str | None = None,
    ) -> PlanResponse:
        """
        Mark a plan as completed.

        POST /api/plans/:id/complete
        Body: {status: "success" | "failed", result: string}

        Args:
            plan_id: ID of the plan
            status: Final status ("success" or "failed")
            result: Optional result message

        Returns:
            PlanResponse with data=updated_plan or error
        """
        try:
            body = {"status": status}
            if result is not None:
                body["result"] = result

            response = self._client.post(
                f"/plans/{plan_id}/complete",
                json=body,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def get_plan(self, plan_id: str) -> PlanResponse:
        """
        Fetch details of a specific plan.

        GET /api/plans/:id

        Args:
            plan_id: ID of the plan to fetch

        Returns:
            PlanResponse with data=plan_details or error
        """
        try:
            response = self._client.get(f"/plans/{plan_id}")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def request_approval(
        self,
        plan_id: str,
        task_id: str,
        tool: str,
        input_data: dict[str, Any],
        reason: str = "",
    ) -> PlanResponse:
        """
        Request approval for a tool operation.

        POST /api/approvals
        Body: {plan_id, task_id, tool, input, reason}

        Args:
            plan_id: ID of the plan
            task_id: ID of the task
            tool: Tool name being requested
            input_data: Tool input parameters
            reason: Reason for approval request

        Returns:
            PlanResponse with data={id: approval_id} or error
        """
        try:
            payload = {
                "plan_id": plan_id,
                "task_id": task_id,
                "tool": tool,
                "input": input_data,
                "reason": reason,
            }
            response = self._client.post(
                "/approvals",
                json=payload,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def wait_for_approval(
        self,
        approval_id: str,
        timeout_seconds: int = 600,
        poll_interval: float = 2.0,
    ) -> PlanResponse:
        """
        Poll for approval decision.

        Continuously polls GET /api/approvals/:id until the approval
        is no longer pending (approved/denied/timeout).

        Args:
            approval_id: ID of the approval request
            timeout_seconds: Maximum time to wait (default: 600 = 10 minutes)
            poll_interval: Seconds between polls (default: 2.0)

        Returns:
            PlanResponse with data=status ("approved" | "denied" | "timeout") or error
        """
        deadline = time.time() + timeout_seconds

        while time.time() < deadline:
            try:
                response = self._client.get(f"/approvals/{approval_id}")
                handled = self._handle_response(response)

                if handled.error:
                    return PlanResponse(data=None, error=handled.error)

                if handled.data:
                    status = handled.data.get("status")
                    if status != "pending":
                        # Approval has been decided
                        return PlanResponse(data=status)

                # Still pending, wait before next poll
                time.sleep(poll_interval)

            except httpx.HTTPError as e:
                return PlanResponse(data=None, error=f"HTTP error: {e}")
            except Exception as e:
                return PlanResponse(data=None, error=f"Polling failed: {e}")

        # Timeout reached
        return PlanResponse(data="timeout")

    async def save_structured_output(self, plan_id: str, output: dict[str, Any]) -> PlanResponse:
        """
        Save structured output (plan/review/diagnosis) from a quick action.

        POST /api/plans/:id/structured-output
        Body: {output: {type: 'plan'|'review'|'diagnosis', content: {...}}}

        Args:
            plan_id: ID of the plan
            output: Structured output with type and content

        Returns:
            PlanResponse with data={saved: true} or error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.post,
                f"/plans/{plan_id}/structured-output",
                json={"output": output},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    async def get_project_agents_context(self, project_id: str) -> str:
        """
        Return a formatted string with available agents for a project.

        This context is injected into planner agents so they can reference
        the correct agents when creating task assignments.

        GET /api/projects/:id/agents-context

        Args:
            project_id: ID of the project

        Returns:
            Formatted string with agent information, or empty string on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.get,
                f"/projects/{project_id}/agents-context",
            )
            handled = self._handle_response(response)

            if handled.error:
                logger.warning(f"Failed to fetch agents context: {handled.error}")
                return ""

            agents = handled.data
            if not agents:
                return ""

            lines = ["## Available Agents for this Project\n"]
            for agent in agents:
                role = agent.get("role", "generic")
                name = agent.get("name", "unknown")
                workspace = agent.get("workspace_path", "")
                lines.append(f"- **{name}** (role: `{role}`)")
                lines.append(f"  workspace: `{workspace}`")

            lines.append("")
            lines.append(
                "When creating task assignments, use the workspace paths above. "
                "Match task type to agent role: coders for implementation, "
                "reviewers for validation, testers for test suites, etc."
            )

            return "\n".join(lines)

        except Exception as e:
            logger.warning(f"Error fetching agents context: {e}")
            return ""

    # Chat session methods

    def get_pending_sessions(self) -> PlanResponse:
        """
        Poll for pending chat sessions.

        GET /api/sessions/pending

        Returns:
            PlanResponse with data=list[Session] or error
        """
        try:
            response = self._client.get("/sessions/pending")
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def save_sdk_session_id(self, session_id: str, sdk_session_id: str) -> PlanResponse:
        """
        Save SDK session ID for a chat session.

        POST /api/sessions/:id/sdk-session
        Body: {sdk_session_id: string}

        Args:
            session_id: ID of the session
            sdk_session_id: SDK session ID to persist

        Returns:
            PlanResponse with data=updated_session or error
        """
        try:
            response = self._client.post(
                f"/sessions/{session_id}/sdk-session",
                json={"sdk_session_id": sdk_session_id},
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    def save_assistant_message(
        self,
        session_id: str,
        content: str,
        structured_output: dict[str, Any] | None = None,
    ) -> PlanResponse:
        """
        Save an assistant message to a chat session.

        POST /api/sessions/:id/assistant-message
        Body: {content: string, structured_output?: dict}

        Args:
            session_id: ID of the session
            content: Message content
            structured_output: Optional structured output (plan/review/diagnosis)

        Returns:
            PlanResponse with data=updated_session or error
        """
        try:
            body = {"content": content}
            if structured_output is not None:
                body["structured_output"] = structured_output

            response = self._client.post(
                f"/sessions/{session_id}/assistant-message",
                json=body,
            )
            return self._handle_response(response)
        except httpx.HTTPError as e:
            return PlanResponse(data=None, error=f"HTTP error: {e}")
        except Exception as e:
            return PlanResponse(data=None, error=f"Request failed: {e}")

    # Kanban pipeline methods

    async def _patch(self, path: str, data: dict[str, Any]) -> dict | None:
        """
        Internal PATCH request method (async).

        Args:
            path: API path (e.g., /kanban/:projectId/:taskId/pipeline)
            data: Request body

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(self._client.patch, path, json=data)
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"PATCH {path} failed: {e}")
            return None

    async def _post(self, path: str, data: dict[str, Any] | None = None) -> dict | list | None:
        """
        Internal POST request method (async).

        Args:
            path: API path (e.g., /plans)
            data: Request body

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(
                self._client.post,
                path,
                json=data or {}
            )
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"POST {path} failed: {e}")
            return None

    async def _get(self, path: str) -> dict | list | None:
        """
        Internal GET request method (async).

        Args:
            path: API path (e.g., /projects)

        Returns:
            Parsed JSON response data, or None on error
        """
        import asyncio

        try:
            response = await asyncio.to_thread(self._client.get, path)
            handled = self._handle_response(response)
            return None if handled.error else handled.data
        except Exception as e:
            logger.warning(f"GET {path} failed: {e}")
            return None

    async def get_pending_kanban_tasks(self, project_id: str) -> list:
        """
        Busca kanban tasks ativas sem workflow vinculado.

        GET /api/kanban/:projectId/pending-pipeline

        Args:
            project_id: ID of the project

        Returns:
            List of kanban tasks or empty list on error
        """
        try:
            data = await self._get(f"/kanban/{project_id}/pending-pipeline")
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning(f"Failed to get pending kanban tasks: {e}")
            return []

    async def get_all_projects(self) -> list:
        """
        Retorna todos os projetos com settings.

        GET /api/projects

        Returns:
            List of projects or empty list on error
        """
        try:
            data = await self._get("/projects")
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning(f"Failed to get projects: {e}")
            return []

    async def update_kanban_pipeline(
        self,
        project_id: str,
        task_id: str,
        **kwargs
    ) -> dict:
        """
        Atualiza pipeline_status de uma kanban task.

        PATCH /api/kanban/:projectId/:taskId/pipeline

        Args:
            project_id: ID of the project
            task_id: ID of the kanban task
            **kwargs: Fields to update (pipeline_status, workflow_id, error_message)

        Returns:
            Updated task data or empty dict on error
        """
        try:
            data = await self._patch(f"/kanban/{project_id}/{task_id}/pipeline", kwargs)
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning(f"Failed to update kanban pipeline: {e}")
            return {}

    async def create_plan_from_data(self, plan_data: dict) -> dict:
        """
        Cria um workflow a partir de um dict de plano.

        POST /api/plans

        Args:
            plan_data: Plan data with name, tasks, project_id, etc.

        Returns:
            Created plan data or empty dict on error
        """
        try:
            data = await self._post("/plans", plan_data)
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning(f"Failed to create plan: {e}")
            return {}

    async def start_plan_async(self, plan_id: str) -> dict:
        """
        Marca um plano como pending para o daemon executar.

        POST /api/plans/:id/start

        Args:
            plan_id: ID of the plan to start

        Returns:
            Updated plan data or empty dict on error
        """
        try:
            data = await self._post(f"/plans/{plan_id}/start", {"client_id": self.client_id})
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning(f"Failed to start plan: {e}")
            return {}

    async def get_plan_logs(self, plan_id: str) -> PlanResponse:
        """
        Busca logs de um plano.

        GET /api/plans/:id/logs

        Args:
            plan_id: ID of the plan

        Returns:
            PlanResponse with data=list[logs] or error
        """
        try:
            data = await self._get(f"/plans/{plan_id}/logs")
            return PlanResponse(data=data, error=None)
        except Exception as e:
            logger.warning(f"Failed to get plan logs {plan_id}: {e}")
            return PlanResponse(data=None, error=f"Failed to get plan logs: {e}")

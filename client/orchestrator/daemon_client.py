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
from dataclasses import dataclass
from typing import Any

import httpx


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

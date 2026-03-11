"""
Tests for approval flow in daemon mode.

Tests the DaemonClient approval methods and deny rule matching logic.
"""

import json
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from httpx import Response

from orchestrator.daemon_client import DaemonClient, PlanResponse
from orchestrator.runner import _check_deny_rules, _load_deny_rules


class TestDaemonClientApproval:
    """Test DaemonClient approval methods."""

    def setup_method(self):
        """Set up test fixtures."""
        self.client = DaemonClient(
            server_url="http://localhost:3001",
            token="test-token",
        )

    def test_request_approval_success(self):
        """Test successful approval request."""
        approval_id = "approval-123"

        # Mock HTTP response
        mock_response = Mock(spec=Response)
        mock_response.json.return_value = {
            "data": {"id": approval_id, "status": "pending"},
            "error": None,
        }
        self.client._client.post = Mock(return_value=mock_response)

        result = self.client.request_approval(
            plan_id="plan-1",
            task_id="task-1",
            tool="Bash",
            input_data={"command": "rm -rf /tmp/test"},
            reason="Matches deny rule: Bash(rm -rf *)",
        )

        assert result.error is None
        assert result.data == {"id": approval_id, "status": "pending"}
        self.client._client.post.assert_called_once()

    def test_request_approval_http_error(self):
        """Test approval request with HTTP error."""
        self.client._client.post = Mock(side_effect=Exception("Connection error"))

        result = self.client.request_approval(
            plan_id="plan-1",
            task_id="task-1",
            tool="Bash",
            input_data={"command": "rm -rf /tmp/test"},
        )

        assert result.data is None
        assert "HTTP error" in result.error or "Request failed" in result.error

    def test_wait_for_approval_approved(self):
        """Test waiting for approval that gets approved."""
        approval_id = "approval-123"

        # Mock first call returns pending, second returns approved
        mock_responses = [
            Mock(spec=Response),
            Mock(spec=Response),
        ]
        mock_responses[0].json.return_value = {
            "data": {"id": approval_id, "status": "pending"},
            "error": None,
        }
        mock_responses[1].json.return_value = {
            "data": {"id": approval_id, "status": "approved"},
            "error": None,
        }

        call_count = [0]

        def mock_get(*args, **kwargs):
            resp = mock_responses[call_count[0]]
            call_count[0] += 1
            return resp

        self.client._client.get = Mock(side_effect=mock_get)

        # Mock time.sleep to avoid delay
        with patch("time.sleep"):
            result = self.client.wait_for_approval(
                approval_id=approval_id,
                timeout_seconds=10,
                poll_interval=0.1,
            )

        assert result.error is None
        assert result.data == "approved"

    def test_wait_for_approval_denied(self):
        """Test waiting for approval that gets denied."""
        approval_id = "approval-123"

        mock_response = Mock(spec=Response)
        mock_response.json.return_value = {
            "data": {"id": approval_id, "status": "denied"},
            "error": None,
        }
        self.client._client.get = Mock(return_value=mock_response)

        result = self.client.wait_for_approval(
            approval_id=approval_id,
            timeout_seconds=10,
        )

        assert result.error is None
        assert result.data == "denied"

    def test_wait_for_approval_timeout(self):
        """Test waiting for approval that times out."""
        approval_id = "approval-123"

        # Always return pending
        mock_response = Mock(spec=Response)
        mock_response.json.return_value = {
            "data": {"id": approval_id, "status": "pending"},
            "error": None,
        }
        self.client._client.get = Mock(return_value=mock_response)

        import time

        # Mock time.time to simulate timeout - first call returns normal time,
        # subsequent calls return time past deadline
        original_time = time.time()
        call_count = [0]

        def mock_time():
            call_count[0] += 1
            if call_count[0] == 1:
                return original_time
            return original_time + 1000  # Past any reasonable timeout

        with patch("time.time", side_effect=mock_time):
            result = self.client.wait_for_approval(
                approval_id=approval_id,
                timeout_seconds=10,
                poll_interval=0.1,
            )

        assert result.error is None
        assert result.data == "timeout"


class TestDenyRules:
    """Test deny rule matching logic."""

    def test_exact_tool_match(self):
        """Test exact tool name match."""
        deny_rules = ["Bash", "Write", "Edit"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "ls"},
            deny_rules=deny_rules,
        )

        assert needs_approval is True
        assert matched == "Bash"

    def test_pattern_match_wildcard(self):
        """Test pattern match with wildcard."""
        deny_rules = ["Bash(rm -rf *)"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "rm -rf /tmp/test"},
            deny_rules=deny_rules,
        )

        assert needs_approval is True
        assert matched == "Bash(rm -rf *)"

    def test_pattern_match_substring(self):
        """Test pattern match without wildcard."""
        deny_rules = ["Bash(rm -rf /tmp)"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "rm -rf /tmp/test"},
            deny_rules=deny_rules,
        )

        assert needs_approval is True
        assert matched == "Bash(rm -rf /tmp)"

    def test_no_match(self):
        """Test no matching rule."""
        deny_rules = ["Bash(rm -rf *)", "Write(/etc/*)"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "ls -la"},
            deny_rules=deny_rules,
        )

        assert needs_approval is False
        assert matched == ""

    def test_different_tool(self):
        """Test different tool not in rules."""
        deny_rules = ["Bash", "Edit"]

        needs_approval, matched = _check_deny_rules(
            tool_name="Read",
            tool_input={"path": "/tmp/file.txt"},
            deny_rules=deny_rules,
        )

        assert needs_approval is False
        assert matched == ""

    def test_empty_deny_rules(self):
        """Test with empty deny rules list."""
        deny_rules = []

        needs_approval, matched = _check_deny_rules(
            tool_name="Bash",
            tool_input={"command": "rm -rf /tmp"},
            deny_rules=deny_rules,
        )

        assert needs_approval is False
        assert matched == ""


class TestLoadDenyRules:
    """Test loading deny rules from settings.local.json."""

    def test_load_deny_rules_success(self, tmp_path):
        """Test successfully loading deny rules."""
        settings_path = tmp_path / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True)
        settings_path.write_text(
            json.dumps(
                {
                    "permissions": {
                        "deny": ["Bash", "Write(/etc/*)", "Edit(*.password)"]
                    }
                }
            )
        )

        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == ["Bash", "Write(/etc/*)", "Edit(*.password)"]

    def test_load_deny_rules_no_file(self, tmp_path):
        """Test loading when settings file doesn't exist."""
        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == []

    def test_load_deny_rules_no_permissions(self, tmp_path):
        """Test loading when permissions section is missing."""
        settings_path = tmp_path / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True)
        settings_path.write_text(json.dumps({"env": {"TEST": "value"}}))

        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == []

    def test_load_deny_rules_invalid_json(self, tmp_path):
        """Test loading with invalid JSON."""
        settings_path = tmp_path / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True)
        settings_path.write_text("invalid json")

        rules = _load_deny_rules(str(tmp_path), str(tmp_path))

        assert rules == []

    def test_load_deny_rules_workspace_fallback(self, tmp_path):
        """Test workspace priority over cwd."""
        # Create workspace settings
        workspace_path = tmp_path / "workspace"
        workspace_path.mkdir(parents=True)
        workspace_settings = workspace_path / ".claude" / "settings.local.json"
        workspace_settings.parent.mkdir(parents=True)
        workspace_settings.write_text(
            json.dumps({"permissions": {"deny": ["Bash"]}})
        )

        # Create cwd settings
        cwd_path = tmp_path / "cwd"
        cwd_path.mkdir(parents=True)

        # Should use workspace settings
        rules = _load_deny_rules(str(workspace_path), str(cwd_path))

        assert rules == ["Bash"]

# Investigation Report: Chat OAuth Failure vs Workflow Success

**Date:** 2026-03-12
**Issue:** Chat sessions fail with OAuth authentication errors while workflows work correctly
**Status:** ROOT CAUSE IDENTIFIED

---

## Executive Summary

The chat fails with OAuth authentication because the `chat_runner.py` does NOT set `setting_sources=['project']` when creating `ClaudeAgentOptions`, causing the Claude CLI to ignore the workspace `settings.local.json` file that contains `ANTHROPIC_BASE_URL`.

The workflow runner correctly sets `setting_sources=['project']`, which allows it to load the custom API endpoint configuration.

---

## Step 1: Code Analysis

### Chat Runner (`client/orchestrator/chat_runner.py`)

**Lines 62-88:**
```python
options_kwargs = {
    "cwd": workspace_path,
    "permission_mode": "acceptEdits",
}
# ... later ...
if sdk_session_id:
    options_kwargs["resume"] = sdk_session_id

options_kwargs["stderr"] = stderr_callback
options_kwargs["extra_args"] = {"debug-to-stderr": True}

options = ClaudeAgentOptions(**options_kwargs)
```

**CRITICAL:** `setting_sources` is NOT defined, leaving it as `None`.

### Workflow Runner (`client/orchestrator/runner.py`)

**Lines 383-392:**
```python
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
```

**CORRECT:** `setting_sources=["project"]` is explicitly set.

---

## Step 2: SDK Investigation

### ClaudeAgentOptions Fields

The SDK version is `0.1.48`. The `ClaudeAgentOptions` dataclass includes:

```python
@dataclass
class ClaudeAgentOptions:
    # ... many fields ...
    cwd: str | Path | None = None
    settings: str | None = None
    setting_sources: list[SettingSource] | None = None  # <-- CRITICAL FIELD
    # ... more fields ...
```

Where `SettingSource = Literal["user", "project", "local"]`.

### How setting_sources is Used

In `/root/projects/agents-manager/client/venv/lib/python3.12/site-packages/claude_agent_sdk/_internal/transport/subprocess_cli.py`:

**Lines 276-281:**
```python
sources_value = (
    ",".join(self._options.setting_sources)
    if self._options.setting_sources is not None
    else ""
)
cmd.extend(["--setting-sources", sources_value])
```

When `setting_sources=None`, it generates `--setting-sources ""` (empty string).

---

## Step 3: Settings Files Verification

Both workspaces have valid `settings.local.json` files:

### Chat Workspace (`projects/agents-manager/agents/planner/.claude/settings.local.json`)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8083",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR": "1"
  },
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob", "Skill"],
    "deny": ["Bash(git push --force)", "Bash(sudo:*)"],
    "additionalDirectories": ["/root/projects/agents-manager"]
  }
}
```

### Workflow Workspace (`projects/agents-manager/agent-coder/.claude/settings.local.json`)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8083",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR": "1"
  },
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob"],
    "deny": ["Bash(git push --force)", "Bash(sudo:*)"],
    "additionalDirectories": ["/root/projects/agents-manager"]
  }
}
```

**Both files are valid and contain the required `ANTHROPIC_BASE_URL`.**

---

## Step 4: Command Generation Test

### Test Results

```python
# Chat (without setting_sources)
cmd = ["claude", "--output-format", "stream-json", "--verbose", ..., "--setting-sources", ""]
#                                                                                    ^^ EMPTY

# Workflow (with setting_sources=["project"])
cmd = ["claude", "--output-format", "stream-json", "--verbose", ..., "--setting-sources", "project"]
#                                                                                    ^^^^^^^ CORRECT
```

**Output:**
```
Chat:   --setting-sources
Workflow: --setting-sources project
```

---

## Root Cause Analysis

### What Happens

1. **Chat runner** creates `ClaudeAgentOptions` without `setting_sources`
2. SDK sees `setting_sources=None` and generates CLI argument: `--setting-sources ""`
3. Claude CLI receives empty string and DOES NOT load project settings
4. Without project settings, `ANTHROPIC_BASE_URL` is never set
5. Claude SDK falls back to default OAuth authentication (which fails)
6. Error: "OAuth authentication failed"

### Why Workflow Works

1. **Workflow runner** explicitly sets `setting_sources=["project"]`
2. SDK generates CLI argument: `--setting-sources "project"`
3. Claude CLI loads project settings from `{cwd}/.claude/settings.local.json`
4. `ANTHROPIC_BASE_URL=http://localhost:8083` is applied
5. Authentication succeeds using llm-router

---

## The Fix

### File: `client/orchestrator/chat_runner.py`

**Lines 62-66, change from:**
```python
options_kwargs = {
    "cwd": workspace_path,
    "permission_mode": "acceptEdits",
}
```

**To:**
```python
options_kwargs = {
    "cwd": workspace_path,
    "permission_mode": "acceptEdits",
    "setting_sources": ["project"],  # Load .claude/settings.local.json from workspace
}
```

### Why This Fix Works

1. Explicitly sets `setting_sources=["project"]` (same as workflow)
2. Claude CLI will load `{workspace_path}/.claude/settings.local.json`
3. `ANTHROPIC_BASE_URL=http://localhost:8083` will be applied
4. Authentication will succeed using llm-router instead of OAuth

---

## Verification Steps

After applying the fix, verify:

1. **Check the generated command:**
   ```bash
   # Should show: --setting-sources project
   # Instead of:  --setting-sources
   ```

2. **Test chat session:**
   - Create a new chat session
   - Send a message
   - Should NOT see "OAuth authentication failed" error

3. **Verify settings are loaded:**
   - Check that ANTHROPIC_BASE_URL is being used
   - API calls should go to http://localhost:8083

---

## Additional Notes

### Why `setting_sources=["project"]` is Important

The `setting_sources` parameter tells the Claude CLI which configuration files to load:

- **"user"**: `~/.claude/settings.json` (global user settings)
- **"project"**: `{cwd}/.claude/settings.json` and `{cwd}/.claude/settings.local.json`
- **"local"**: `{cwd}/.claude/settings.local.json` only

By using `["project"]`, the CLI loads both the project-level settings (for team-shared config) and local settings (for machine-specific overrides like API endpoints).

### Comment in Code Already Warned About This

Interestingly, the workflow runner already has a helpful comment (line 389-391):

```python
# "project" loads CLAUDE.md, .claude/skills/, .claude/agents/, .claude/settings*.json
# from the cwd. Without this, all project-level features are silently ignored.
```

This comment should be copied to the chat runner after the fix.

---

## Related Files

- `client/orchestrator/chat_runner.py` - **NEEDS FIX**
- `client/orchestrator/runner.py` - Already correct (reference)
- `projects/agents-manager/agents/planner/.claude/settings.local.json` - Valid
- `projects/agents-manager/agent-coder/.claude/settings.local.json` - Valid

---

## Conclusion

**ROOT CAUSE:** Missing `setting_sources=["project"]` in `chat_runner.py`

**IMPACT:** Chat sessions cannot authenticate because Claude CLI ignores workspace settings

**FIX:** Add one line to `chat_runner.py`:
```python
"setting_sources": ["project"],
```

**EFFORT:** 2 minutes to fix and test

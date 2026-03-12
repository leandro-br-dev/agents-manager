# Stderr Capture Fix — Summary

## Problem
The error message `Command failed with exit code 1 / Check stderr output for details` was hiding the actual error, making debugging impossible.

## Root Cause Analysis

### SDK Implementation Issue
The Claude Agent SDK (`claude_agent_sdk`) has a flaw in `subprocess_cli.py` (lines 588-594):

```python
if returncode is not None and returncode != 0:
    self._exit_error = ProcessError(
        f"Command failed with exit code {returncode}",
        exit_code=returncode,
        stderr="Check stderr output for details",  # ← HARDCODED!
    )
    raise self._exit_error
```

The `stderr` field is hardcoded to a generic message instead of capturing the actual stderr from the CLI process.

### Why stderr wasn't captured
The SDK only pipes stderr when:
1. A `stderr` callback is provided in options, OR
2. `debug-to-stderr` is in `extra_args`

See `subprocess_cli.py` lines 369-377:
```python
should_pipe_stderr = (
    self._options.stderr is not None
    or "debug-to-stderr" in self._options.extra_args
)
```

## Solution Implemented

### 1. Enable stderr capture in chat_runner.py
Added:
- `StringIO` buffer to capture stderr lines
- `stderr_callback` function to collect stderr
- `debug-to-stderr` extra_arg to enable piping
- Updated error handling to read from buffer instead of SDK's ProcessError.stderr

### 2. Code Changes
```python
# Capture stderr to get real error messages
stderr_buffer = StringIO()

def stderr_callback(line: str) -> None:
    """Capture stderr lines for better error diagnostics."""
    logger.debug(f"Claude CLI stderr: {line}")
    stderr_buffer.write(line + "\n")

options_kwargs["stderr"] = stderr_callback
options_kwargs["extra_args"] = {"debug-to-stderr": True}
```

### 3. Enhanced error handling
```python
# Get the real stderr from our buffer
real_stderr = stderr_buffer.getvalue()
if real_stderr:
    error_details += f"\n\nStderr output:\n{real_stderr}"
```

## Benefits

1. **Exposes real errors**: Now shows actual CLI errors (auth failures, connectivity issues, etc.)
2. **Better debugging**: Developers can see what actually went wrong
3. **Helpful context**: Already had checks for common issues (nested sessions, llm-router connectivity)
4. **No SDK changes needed**: Workaround at application level

## Testing

Created `test-stderr-capture.sh` to validate the fix:
- Resets stuck sessions
- Creates test session
- Sends message and captures response
- Checks session status and messages

## Related Files

- `client/orchestrator/chat_runner.py` — Main fix
- `start.sh` — Already had llm-router health check (lines 30-38)
- `test-stderr-capture.sh` — New test script

## Future Improvements

1. **Fix the SDK**: The proper fix would be in the SDK itself to capture stderr by default
2. **Better error categorization**: Parse stderr to detect specific error types
3. **Retry logic**: For transient errors (network blips, temporary auth failures)
4. **Metrics**: Track error types for monitoring

## Example Output

Before:
```
❌ Command failed with exit code 1
Exit code: 1
Stderr: Check stderr output for details
```

After (with llm-router down):
```
❌ Command failed with exit code 1
Exit code: 1

Stderr output:
Error: connect ECONNREFUSED 127.0.0.1:8083
    at TCPConnectWrap.connect (net.js:...)

⚠️  ANTHROPIC_BASE_URL=http://localhost:8083 is not accessible: ...
   Ensure the service (e.g., llm-router) is running.
```

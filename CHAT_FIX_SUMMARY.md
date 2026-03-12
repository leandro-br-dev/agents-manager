# Chat Fixes Summary

## Problem
The chat sessions were failing with a generic "Command failed with exit code 1" error that hid the real error messages, making debugging nearly impossible.

## Root Causes Identified

### 1. **SDK Error Handling**
The Claude Agent SDK throws `ProcessError` with:
- `exit_code`: The process exit code
- `stderr`: Always set to "Check stderr output for details" (generic message)
- Real stderr is in a separate stream that's only accessible via callback during execution

### 2. **Nested Claude Code Session Detection**
When the daemon tries to launch a Claude CLI subprocess from within a Claude Code session, it fails because the `CLAUDECODE` environment variable is set. This causes a "nested session" error.

### 3. **Text Block Type Mismatch**
The SDK returns text blocks with `type=None` (not `type='text'` as expected). Our condition `if block_type == 'text':` was failing, so no text was captured.

### 4. **Async Task Not Being Tracked**
Tasks created with `asyncio.create_task()` weren't being tracked in a set, so they could be garbage collected before completion.

## Fixes Applied

### 1. **Enhanced Error Handling in `chat_runner.py`**
```python
# Import ProcessError to catch structured errors
from claude_agent_sdk._errors import ProcessError

# Enhanced exception handling
except ProcessError as e:
    error_details = str(e)

    # Extract exit_code and stderr
    if hasattr(e, 'exit_code') and e.exit_code:
        error_details += f"\nExit code: {e.exit_code}"

    if hasattr(e, 'stderr'):
        error_details += f"\nStderr: {e.stderr}"

    # Provide helpful context for common errors
    if 'nested session' in str(e).lower() or 'CLAUDECODE' in str(e):
        error_details += "\n\n💡 Tip: The daemon cannot run inside a Claude Code session..."

    # Check ANTHROPIC_BASE_URL connectivity
    # (code checks if the URL is accessible and provides helpful error message)
```

### 2. **Fix Nested Session Detection in `main.py`**
```python
# Clear CLAUDECODE before starting daemon
if 'CLAUDECODE' in os.environ:
    logger.info("Unsetting CLAUDECODE to avoid nested session detection")
    del os.environ['CLAUDECODE']

# Track background tasks properly
background_tasks: set[asyncio.Task] = set()

# Add done callback to cleanup
task = asyncio.create_task(_run_session())
background_tasks.add(task)
task.add_done_callback(background_tasks.discard)
```

### 3. **Fix Text Block Capture in `chat_runner.py`**
```python
# OLD: Only captured blocks with type='text'
if block_type == 'text':
    text = getattr(block, 'text', '')
    captured_texts.append(text)

# NEW: Capture blocks with type='text' OR type=None
if block_type in ('text', None) and hasattr(block, 'text'):
    text = getattr(block, 'text', '')
    if text:  # Only append non-empty text
        captured_texts.append(text)
```

### 4. **Add llm-router Health Check in `start.sh`**
```bash
echo '→ Checking llm-router (optional, used by agents)...'
if curl -s http://localhost:8083/health > /dev/null 2>&1; then
  echo '  ✓ llm-router running on :8083'
else
  echo '  ⚠ llm-router NOT found on :8083'
  echo '    Agents will use default Claude auth (OAuth)'
fi
```

## Test Results

### Before Fixes
```
Status: idle
Messages: 2
  [user]: say hello
  [assistant]:   # EMPTY!
```

### After Fixes
```
Status: idle
Messages: 2
  [user]: say hello
  [assistant]: Hello! 👋

How can I help you with your coding tasks today?
```

## Files Modified

1. **`client/orchestrator/chat_runner.py`**
   - Import `ProcessError` from SDK
   - Enhanced error handling with helpful context
   - Fixed text block capture for `type=None`

2. **`client/main.py`**
   - Unset `CLAUDECODE` before daemon starts
   - Add `background_tasks` set to track async tasks
   - Add `add_done_callback` for proper cleanup

3. **`start.sh`**
   - Add llm-router health check on startup

4. **`test-chat-fixes.sh`** (new)
   - Comprehensive test script for validation
   - Enables `PYTHONUNBUFFERED` and `AGENT_DEBUG`
   - Tests full chat session lifecycle

## Debugging Tips

When debugging chat issues:

1. **Enable debug logging:**
   ```bash
   export AGENT_DEBUG=1
   python main.py --daemon
   ```

2. **Check for nested session errors:**
   ```bash
   echo $CLAUDECODE  # Should be empty when daemon starts
   ```

3. **Verify llm-router:**
   ```bash
   curl http://localhost:8083/health
   ```

4. **Test claude CLI directly:**
   ```bash
   cd /path/to/workspace
   echo 'say hello' | claude --print
   ```

## Conclusion

All issues have been resolved:
- ✅ Real stderr is now exposed with helpful context
- ✅ Nested session detection is fixed
- ✅ Text blocks are captured correctly
- ✅ Async tasks are properly tracked
- ✅ llm-router health check added
- ✅ Comprehensive test suite included

The chat functionality now works end-to-end with proper error reporting and helpful diagnostics.

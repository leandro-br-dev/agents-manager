# Daemon Mode

The agent-client can run in daemon mode, continuously polling the agents-manager API for pending plans and executing them.

## Usage

```bash
python main.py --daemon --server http://localhost:3001 --token YOUR_TOKEN
```

### Environment Variables

You can use environment variables instead of CLI flags:

```bash
export AGENTS_MANAGER_URL="http://localhost:3001"
export AGENTS_MANAGER_TOKEN="your-token-here"
python main.py --daemon
```

### Priority

CLI flags override environment variables:
- `--server` overrides `AGENTS_MANAGER_URL`
- `--token` overrides `AGENTS_MANAGER_TOKEN`

### Defaults

- If no server URL is specified, defaults to `http://localhost:3001`
- Token is **required** for daemon mode

## Behavior

1. **Polling**: Daemon polls `GET /api/plans/pending` every 5 seconds
2. **Plan Detection**: When pending plans are found, each is processed
3. **Start Execution**: Sends `POST /api/plans/:id/start` with `{client_id: hostname}`
4. **Execute Plan**: Runs the plan using the existing runner (runner.py)
5. **Log Streaming**: After each task, sends logs to `POST /api/plans/:id/logs`
6. **Completion**: Sends `POST /api/plans/:id/complete` with `{status, result}`

## Graceful Shutdown

The daemon handles shutdown signals gracefully:
- `SIGINT` (Ctrl+C)
- `SIGTERM`

When a signal is received, the daemon:
1. Stops polling for new plans
2. Finishes executing the current plan (if any)
3. Sends completion status to the API
4. Exits cleanly

## Architecture

```
┌─────────────────┐
│   main.py       │
│  (daemon mode)  │
└────────┬────────┘
         │
         ├──────────────────────────────────┐
         │                                  │
         ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐
│ DaemonClient    │              │ runner.py       │
│ (HTTP client)   │◄─────────────┤ (plan executor) │
└─────────────────┘              └─────────────────┘
         │                                  │
         │                                  │
         ▼                                  ▼
┌─────────────────┐              ┌─────────────────┐
│ agents-manager  │              │ Claude Agent    │
│ API (Node.js)   │              │ SDK             │
└─────────────────┘              └─────────────────┘
```

## Implementation Details

### DaemonClient (`orchestrator/daemon_client.py`)

HTTP client for API communication:
- `get_pending_plans()` - Poll for pending plans
- `start_plan(plan_id)` - Mark plan as running
- `send_logs(plan_id, logs)` - Submit log entries
- `complete_plan(plan_id, status, result)` - Mark plan as complete

All methods return a `PlanResponse` envelope with `{data, error}`.

### Log Collection

The `DaemonLogCollector` class captures logs during execution:
- Tracks current task ID
- Buffers log entries
- Returns logs for API submission after each task

### Execution Flow

1. **Polling Loop**: Runs in `run_daemon()` function
2. **Plan Execution**: Handled by `run_plan_with_logging()`
3. **Log Streaming**: Logs sent after each task completion
4. **Error Handling**: Failures sent to API, doesn't crash daemon

## Testing

Run the daemon client tests:

```bash
pytest tests/test_daemon_client.py -v
```

Tests use mocked HTTP responses to verify:
- API endpoint calls
- Request formatting
- Response parsing
- Error handling

## Orphaned Daemon Processes

If a daemon session is terminated abruptly (e.g., SSH disconnect, system crash), the daemon process may continue running in the background.

### Checking for Orphaned Daemons

```bash
# Check for daemon processes
ps aux | grep 'main.py --daemon'

# Check for agent-client processes
ps aux | grep 'agent-client'
```

### Killing Orphaned Daemons

To kill all daemon processes:

```bash
# Kill all daemon processes
pkill -f 'main.py --daemon'

# Or kill by specific PID
kill <PID>

# Force kill if necessary
kill -9 <PID>
```

### Example Output

```
root     1231888  0.6  0.2  64852 56588 pts/11   S+   19:03   0:00 python main.py --daemon
```

In this example, PID `1231888` is the daemon process.

## Error Logging

The daemon now includes comprehensive error logging:

- **Initialization errors** are captured and reported to the API
- **Workspace validation** ensures the working directory exists before execution
- **Task failures** are logged with detailed error messages
- **All errors** are sent to the API via `complete_plan(plan_id, 'failed', error_message)`

## Troubleshooting

### Daemon fails instantly without logs

This typically means:
1. The working directory (`cwd`) specified in a task doesn't exist
2. The Claude Agent SDK failed to initialize
3. Authentication credentials are invalid

Check the daemon output for error messages - all errors are now logged and sent to the API.

### Plans stuck in "running" state

If a daemon crashed while executing a plan, the plan may remain in "running" state. You'll need to:
1. Kill any orphaned daemon processes (see above)
2. Manually update the plan status in the database to "failed"
3. Check the logs for the error that caused the crash

### High memory usage

The daemon spawns subprocesses for each task. If tasks are long-running, memory usage may increase. Consider:
- Restarting the daemon periodically
- Implementing a maximum execution time per plan
- Monitoring resource usage with `top` or `htop`

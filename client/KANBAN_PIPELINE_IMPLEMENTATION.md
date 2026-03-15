# Kanban Pipeline Monitor - Implementation Summary

## Overview
Added automatic kanban task monitoring to the daemon. The daemon now continuously polls for kanban tasks in the 'active' column without a linked workflow, automatically generates execution plans via the planning agent, and creates workflows.

## Changes Made

### 1. DaemonClient Methods (`client/orchestrator/daemon_client.py`)

Added internal HTTP methods:
- `_patch(path, data)` - Internal PATCH request method
- `_post(path, data)` - Internal POST request method
- `_get(path)` - Internal GET request method

Added kanban pipeline methods:
- `get_pending_kanban_tasks(project_id)` - Fetches active kanban tasks without workflow
- `get_all_projects()` - Returns all projects with settings
- `update_kanban_pipeline(project_id, task_id, **kwargs)` - Updates pipeline status
- `create_plan_from_data(plan_data)` - Creates a workflow from plan dict
- `start_plan_async(plan_id)` - Marks plan as pending for daemon execution

### 2. Kanban Pipeline Module (`client/orchestrator/kanban_pipeline.py`)

New module with the following components:

**`extract_plan_from_text(text)`**
- Extracts JSON plan from `<plan>...</plan>` tags
- Validates plan structure (name, tasks list)
- Returns validated plan dict or None

**`find_planner_workspace(project_id, client)`**
- Finds the planner agent's workspace for a project
- Queries `/api/projects/:id/agents-context`
- Returns workspace path or None

**`process_kanban_task(task, client)`**
Main processing logic for a single kanban task:
1. Marks task as 'planning'
2. Finds project's planner agent workspace
3. Builds prompt with task details and agents context
4. Executes planning agent via Claude Agent SDK
5. Extracts plan from agent response
6. Creates workflow via API
7. Links workflow to kanban task
8. Auto-approves if `auto_approve_workflows` is enabled
9. Handles errors and updates status

**`poll_kanban_tasks(client)`**
- Iterates through all projects
- Fetches pending kanban tasks for each project
- Spawns background tasks for processing
- Non-blocking: doesn't delay daemon loop

**`_running_kanban_tasks` (global set)**
- Tracks tasks currently being processed
- Prevents duplicate processing

### 3. Daemon Loop Integration (`client/main.py`)

Modified the daemon loop to:
1. Import `poll_kanban_tasks` from `kanban_pipeline`
2. Call `await poll_kanban_tasks(client)` after chat session polling
3. Handle exceptions with proper logging
4. Updated startup message to mention kanban tasks

## How It Works

### Flow Diagram

```
Daemon Loop (every 5 seconds)
├─ Poll pending plans
├─ Poll pending chat sessions
└─ Poll kanban tasks
   └─ For each project:
      └─ GET /api/kanban/:projectId/pending-pipeline
         └─ For each active task without workflow:
            └─ Spawn background task:
               └─ process_kanban_task()
                  ├─ Mark as 'planning'
                  ├─ Find planner workspace
                  ├─ Run planning agent via SDK
                  ├─ Extract <plan> JSON
                  ├─ POST /api/plans (create workflow)
                  ├─ PATCH kanban task with workflow_id
                  ├─ If auto_approve: POST /api/plans/:id/start
                  └─ On error: mark as 'failed'
```

### API Endpoints Used

**Existing (from previous task):**
- `GET /api/kanban/:projectId/pending-pipeline` - Returns tasks needing workflow
- `PATCH /api/kanban/:projectId/:taskId/pipeline` - Updates pipeline status

**Used by this implementation:**
- `GET /api/projects` - Lists all projects with settings
- `GET /api/projects/:id/agents-context` - Gets planner workspace
- `POST /api/plans` - Creates workflow from plan data
- `POST /api/plans/:id/start` - Marks plan as pending

### Project Settings

Kanban tasks respect the `auto_approve_workflows` setting in project settings:

```json
{
  "auto_approve_workflows": true
}
```

When enabled, workflows are automatically started after creation.

## Error Handling

- All methods return empty containers (list/dict) on error
- Failed tasks marked with `pipeline_status='failed'` and `error_message`
- Logging at all levels (info, warning, error, success)
- Background task failures don't crash daemon loop

## Verification

All tests passed:
```bash
✅ Syntax OK - kanban_pipeline.py imports successfully
✅ Extracted: plan JSON correctly parsed
✅ DaemonClient has all new methods
✅ main.py syntax valid
```

## Usage

1. **Create a kanban task** in a project:
   - Move task to 'active' column
   - The daemon will detect it (no workflow_id)

2. **Daemon automatically:**
   - Runs the planning agent
   - Generates execution plan
   - Creates workflow
   - Links workflow to kanban task
   - Optionally auto-approves

3. **Monitor progress:**
   - Check kanban task `pipeline_status` field
   - Status progression: `idle` → `planning` → `awaiting_approval` → `running`
   - On error: `failed` with `error_message`

## Technical Notes

- Uses `asyncio.create_task()` for non-blocking background processing
- Tracks running tasks to prevent duplicate processing
- Claude Agent SDK integration follows existing `chat_runner.py` patterns
- Compatible with both synchronous and asynchronous DaemonClient methods
- Graceful degradation: errors don't stop daemon loop

## Future Enhancements

Possible improvements:
1. Configurable poll interval for kanban tasks
2. Batch processing of multiple tasks
3. Priority queuing based on task importance
4. Webhook notifications when workflows are created
5. Manual retry mechanism for failed tasks

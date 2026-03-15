# Kanban Pipeline: Robust Fallback for normalize_plan_tasks

## Summary

Updated `normalize_plan_tasks()` function to accept `planning_context` parameter and provide robust fallback values for `cwd` and `workspace` when the planning agent doesn't generate them correctly.

## Problem

The planning agent was sometimes generating:
- `cwd: /root/projects/agents-manager/api/src/routes` (a subdirectory instead of project_path)
- `workspace` empty

This caused tasks to fail when executed by the workflow runner.

## Solution

### 1. Enhanced `normalize_plan_tasks()` Function

**New parameter:**
- `planning_context` (optional): Contains `environments` and `agents` data

**Fallback logic:**
- **cwd fallback**: Uses first environment's `project_path`
- **workspace fallback**: Maps agent role to `workspace_path` from agents list

**Priority:**
1. Explicit task values (cwd, workspace)
2. Alternative field names (workingDirectory, working_directory)
3. Fallback from planning_context
4. Empty string (last resort)

### 2. Updated Function Call

In `process_kanban_task()`:
```python
plan_data = normalize_plan_tasks(plan_data, planning_context=planning_context)
```

### 3. Enhanced Logging

Logs show:
- When fallback workspace is used (by role)
- Final cwd and workspace values for each task

## Implementation Details

### Fallback Extraction

```python
fallback_cwd = ''
fallback_workspace_by_role = {}

if planning_context:
    envs = planning_context.get('environments', [])
    if envs:
        fallback_cwd = envs[0].get('project_path', '')

    # Mapa role → workspace_path para fallback
    for agent in planning_context.get('agents', []):
        role = agent.get('role', 'generic')
        ws = agent.get('workspace_path', '')
        if ws and role not in fallback_workspace_by_role:
            fallback_workspace_by_role[role] = ws
```

### Workspace Fallback by Role

```python
if not workspace:
    task_role = 'coder'  # default
    if isinstance(task.get('agent'), dict):
        task_role = task['agent'].get('role', 'coder')
    workspace = fallback_workspace_by_role.get(task_role, '')
    if workspace:
        logger.info(f'[KanbanPipeline] Using fallback workspace for role {task_role}: {workspace}')
```

## Testing

All tests passed:

1. ✅ Backward compatibility: Works without planning_context
2. ✅ Fallback values: Uses environment project_path and agent workspace_path
3. ✅ Explicit values: Takes precedence over fallbacks
4. ✅ Role-based workspace: Correctly maps role to workspace_path
5. ✅ Syntax check: Python compilation successful

## Example Output

```
[KanbanPipeline] Using fallback workspace for role coder: /root/projects/agents-manager/client/workspaces/coder
[KanbanPipeline] Task "Implement feature X": cwd=/root/projects/agents-manager/api, workspace=/root/projects/agents-manager/client/workspaces/coder
```

## Files Modified

- `orchestrator/kanban_pipeline.py`:
  - Updated `normalize_plan_tasks()` function signature and implementation
  - Updated call site in `process_kanban_task()`

## Benefits

1. **Robustness**: Tasks will execute even if planning agent omits cwd/workspace
2. **Correctness**: Uses project_path instead of subdirectories
3. **Traceability**: Logs show when fallbacks are used
4. **Backward compatibility**: Existing code continues to work
5. **Role-based mapping**: Automatically assigns correct workspace by agent role

## Next Steps

- Monitor logs for "Using fallback workspace" messages
- If fallbacks are frequently used, improve planning agent instructions
- Consider adding validation to ensure project_path and workspace_path exist

---

**Date**: 2026-03-14
**Status**: ✅ Completed
**Test Results**: All tests passed

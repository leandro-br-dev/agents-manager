# Kanban Pipeline Update - Planning Context Integration

## Summary

Successfully updated `kanban_pipeline.py` to integrate with the full planning context endpoint, providing the planner agent with comprehensive project information.

## Changes Made

### 1. New Function: `build_planning_prompt`

**Location:** `orchestrator/kanban_pipeline.py` lines 114-183

**Purpose:** Builds a rich prompt for the planning agent with all necessary context.

**Features:**
- **Project Context:** Project name and description
- **Environments:** All available environments with their project paths
- **Available Agents:** All agents with their roles and workspace paths
- **Task Details:** Title and description from the kanban task
- **Instructions:** Clear guidance on cwd vs workspace usage

**Sections Generated:**
```markdown
## Project Context
## Environments
## Available Agents
## Task to Plan
## Important: cwd vs workspace
```

### 2. Updated `process_kanban_task` Function

**Changes:**

#### Before:
- Used `get_project_agents_context()` which only returned agents
- Built prompt manually with limited context
- Skill content loading was conditional

#### After:
- **Step 2:** Uses `get_project_planning_context()` for full context
  - Returns: project, environments, and agents
  - Logs counts for debugging

- **Step 3:** Always loads SKILL.md content
  - No longer conditional on `setting_sources`
  - Provides fallback if skill not found

- **Step 4:** Uses `build_planning_prompt()` function
  - Passes task data, planning context, and skill content
  - Generates comprehensive prompt
  - Logs prompt length for monitoring

### 3. Updated Step Numbers

Since more steps were added, all subsequent step numbers were incremented:
- Step 5: Import SDK (was 4)
- Step 6: Run planning agent (was 5)
- Step 7: Response length (was 6)
- Step 8: Extract plan (was 7)
- Step 9: Plan extracted (was 8)
- Step 10: Create workflow (was 9)
- Step 11: Link workflow (was 10)
- Step 12: Auto-approve (was 11)
- Step 13: Final status (was 12)

## Benefits

### 1. **Complete Context**
The planner agent now has access to:
- Project metadata (name, description)
- All available environments with paths
- All agents with roles and workspaces
- Clear distinction between cwd and workspace

### 2. **Better Plans**
With full context, the planner can:
- Create more accurate task assignments
- Use correct project paths for each environment
- Match tasks to appropriate agent roles
- Generate precise cwd/workspace configurations

### 3. **Improved Maintainability**
- Centralized prompt building logic
- Reusable function for future enhancements
- Clear separation of concerns
- Better logging and debugging

## Example Prompt Structure

```markdown
<skill_content>

---

## Project Context

Name: agents-manager
Description: Multi-agent project management system

## Environments

- **dev** (local-wsl)
  project_path: `/root/projects/agents-manager`
- **production** (ssh)
  project_path: `/var/www/agents-manager`

## Available Agents

- **planner** (role: `planner`)
  workspace: `/root/.../agents/planner`
- **coder-backend** (role: `coder`)
  workspace: `/root/.../agents/coder-backend`

When creating tasks, use the exact `workspace` paths listed above.
Match task type to agent role: planner for planning, coder for implementation, reviewer for validation.

## Task to Plan

Title: Add authentication middleware
Description:
Implement JWT authentication middleware for the API

## Important: cwd vs workspace

- `workspace`: path to the agent's workspace folder (where .claude/settings.local.json lives)
- `cwd`: the project directory where the code lives (use environment project_path above)

For coder agents: set cwd = the environment project_path, workspace = agent workspace_path
For reviewer/tester agents: same pattern

Analyze the task, read the relevant codebase using the project_path above, and generate a precise execution plan.
Output the plan using the <plan>...</plan> format as defined in the skill above.
```

## Testing

### Test Script: `test_kanban_planning.py`

Comprehensive test that verifies:
1. ✅ `build_planning_prompt` function
2. ✅ All required sections present
3. ✅ Correct content formatting
4. ✅ Integration with real API (when available)

### Test Results:
```
✅ Prompt length: 1973 chars
✅ Has project context: True
✅ Has environments: True
✅ Has agents: True
✅ Has task: True
✅ Has cwd instruction: True
✅ Has skill content: True
```

## Files Modified

1. **`orchestrator/kanban_pipeline.py`**
   - Added `build_planning_prompt()` function
   - Updated `process_kanban_task()` function
   - Updated step numbers

2. **`test_kanban_planning.py`** (new)
   - Comprehensive integration test
   - Validates prompt generation
   - Tests real API integration

## Backward Compatibility

✅ **Fully backward compatible**
- Existing functionality preserved
- No breaking changes to API
- Additional context is additive

## Next Steps

The planner agent now has all the information it needs to generate precise, actionable plans. The system can now:

1. Process kanban tasks with full project context
2. Generate plans with accurate agent assignments
3. Use correct paths for each environment
4. Create workflows that are ready to execute

## Related Documentation

- `PLANNING_CONTEXT_IMPLEMENTATION.md` - API endpoint documentation
- `daemon_client.py` - `get_project_planning_context()` method
- `api/src/routes/projects.ts` - API endpoint implementation

---

**Status:** ✅ Complete and tested
**Date:** 2026-03-14
**Author:** Claude Sonnet 4.6

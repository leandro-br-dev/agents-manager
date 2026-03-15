# Agent Context Injection for Planner Agents

## Overview

This feature automatically injects a list of available agents into planner agent contexts when they start executing (via workflow or chat). This allows planners to generate plans that use the correct agents for each task.

## Implementation Status: ✅ COMPLETE

All components are implemented and working:

### 1. API Endpoint
**File**: `api/src/routes/projects.ts` (lines 161-207)

```typescript
// GET /api/projects/:id/agents-context
router.get('/:id/agents-context', authenticateToken, (req, res) => {
  // Fetches agents from project_agents table
  // Joins with workspace_roles to get role information
  // Returns formatted agent list with name, role, workspace_path
})
```

**Response Format**:
```json
{
  "data": [
    {
      "name": "frontend-dev",
      "role": "coder",
      "workspace_path": "/root/projects/agents-manager/projects/myapp/agents/frontend-dev",
      "cwd": null
    },
    {
      "name": "api-tester",
      "role": "tester",
      "workspace_path": "/root/projects/agents-manager/projects/myapp/agents/api-tester",
      "cwd": null
    }
  ],
  "error": null
}
```

### 2. Client Method
**File**: `client/orchestrator/daemon_client.py` (lines 332-383)

```python
async def get_project_agents_context(self, project_id: str) -> str:
    """
    Return a formatted string with available agents for a project.

    This context is injected into planner agents so they can reference
    the correct agents when creating task assignments.
    """
    # Fetches from /api/projects/{project_id}/agents-context
    # Formats as markdown with agent names, roles, and workspace paths
```

**Formatted Output**:
```markdown
## Available Agents for this Project

- **frontend-dev** (role: `coder`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/frontend-dev`
- **api-tester** (role: `tester`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/api-tester`

When creating task assignments, use the workspace paths above. Match task type to agent role: coders for implementation, reviewers for validation, testers for test suites, etc.
```

### 3. Chat Runner Integration
**File**: `client/orchestrator/chat_runner.py` (lines 122-131)

```python
# Inject agents context for planner agents
full_prompt = message
if client and project_id and 'planner' in workspace_path.lower():
    try:
        agents_context = await client.get_project_agents_context(project_id)
        if agents_context:
            full_prompt = f"{agents_context}\n\n---\n\n{message}"
            logger.info(f"[ChatTurn] Injected agents context for planner agent")
    except Exception as e:
        logger.warning(f"[ChatTurn] Failed to fetch agents context: {e}")
```

### 4. Workflow Runner Integration
**File**: `client/orchestrator/runner.py` (lines 347-407, 538-543)

```python
async def build_agent_context(task: Task, client: Any, plan_id: str) -> str:
    """
    Build agent context for planner agents.

    If the task's workspace is a planner agent, fetch the list of available
    agents for the project and format it for injection into the prompt.
    """
    # Checks if task uses a planner agent
    # Fetches project_id from plan
    # Returns formatted agents context

# In run_task function:
agent_context = await build_agent_context(task, client, plan_id)
if agent_context:
    prompt = f"{agent_context}\n\n---\n\n{prompt}"
    logger.debug(f"[{task.id}] Injected agents context for planner agent")
```

### 5. Planner Documentation
**File**: `projects/agents-manager/agents/planner/.claude/skills/planning/SKILL.md` (lines 48-108)

Comprehensive documentation covering:
- How to use the "Available Agents" context
- Agent roles and their purposes
- Best practices for agent assignment
- Examples of properly formatted tasks
- Dependency sequencing guidance

## How It Works

### Workflow Execution Flow

1. **Plan Created**: User creates a plan via the dashboard, selecting a project
2. **Plan Execution**: Daemon picks up the plan and starts execution
3. **Task Processing**: For each task:
   - Check if the task's workspace contains "planner"
   - If yes, fetch agents context via `build_agent_context()`
   - Inject context at the beginning of the task's prompt
   - Planner receives context with all available agents
   - Planner generates plan using correct workspace paths
4. **Task Assignment**: Generated plan tasks reference actual agent workspaces

### Chat Session Flow

1. **Chat Created**: User creates a chat session with a planner agent
2. **Message Processing**: For each user message:
   - Check if workspace_path contains "planner"
   - If yes, fetch agents context for the session's project
   - Prepend context to user message
   - Planner receives context before generating response
3. **Plan Generation**: Planner can reference available agents in its output

## Database Schema

### Tables Involved

**`project_agents`** (lines 124-132 in api/src/db/index.ts):
```sql
CREATE TABLE IF NOT EXISTS project_agents (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, workspace_path)
)
```

**`workspace_roles`** (lines 230-236):
```sql
CREATE TABLE IF NOT EXISTS workspace_roles (
  workspace_path TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'coder' CHECK(role IN ('planner','coder','reviewer','tester','debugger','devops','generic'))
)
```

**`projects`** (lines 99-107):
```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

## Testing

### Manual Testing Steps

1. **Create a Project with Agents**:
   ```bash
   # Via dashboard or API, create a project
   # Link multiple agents with different roles
   ```

2. **Test the Endpoint**:
   ```bash
   PROJECT_ID="<your-project-id>"
   curl -s http://localhost:3000/api/projects/$PROJECT_ID/agents-context \
     -H "Authorization: Bearer dev-token-change-in-production" | python3 -m json.tool
   ```

3. **Test Workflow Execution**:
   - Create a plan that uses a planner agent
   - Execute the plan
   - Check logs for: "Injected agents context for planner agent"

4. **Test Chat Session**:
   - Create a chat session with a planner agent
   - Send a message
   - Check logs for: "Injected agents context for planner agent"

### Verification Checklist

- ✅ API endpoint returns agents with roles
- ✅ Logger import added to daemon_client.py
- ✅ Python syntax is valid (verified with py_compile)
- ✅ Chat runner injects context for planner agents
- ✅ Workflow runner injects context for planner agents
- ✅ Planner SKILL.md documents agent assignment

## Example Usage

### Input: Planner Task Prompt
```
Create a plan to add user authentication to the application
```

### Injected Context (Automatic)
```markdown
## Available Agents for this Project

- **backend-coder** (role: `coder`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/backend-coder`
- **frontend-coder** (role: `coder`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/frontend-coder`
- **code-reviewer** (role: `reviewer`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/code-reviewer`
- **test-automation** (role: `tester`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/test-automation`

---

Working directory: /path/to/project
All files must be created inside /path/to/project.

## Your task
Create a plan to add user authentication to the application
```

### Output: Generated Plan
```json
{
  "name": "Add User Authentication",
  "tasks": [
    {
      "id": "backend-auth",
      "name": "Implement backend authentication",
      "workspace": "/root/projects/agents-manager/projects/myapp/agents/backend-coder",
      "cwd": "/path/to/project/backend"
    },
    {
      "id": "frontend-auth",
      "name": "Implement frontend authentication",
      "workspace": "/root/projects/agents-manager/projects/myapp/agents/frontend-coder",
      "cwd": "/path/to/project/frontend",
      "depends_on": ["backend-auth"]
    },
    {
      "id": "review-auth",
      "name": "Review authentication implementation",
      "workspace": "/root/projects/agents-manager/projects/myapp/agents/code-reviewer",
      "depends_on": ["frontend-auth"]
    },
    {
      "id": "test-auth",
      "name": "Test authentication flow",
      "workspace": "/root/projects/agents-manager/projects/myapp/agents/test-automation",
      "depends_on": ["review-auth"]
    }
  ]
}
```

## Benefits

1. **Accurate Agent Assignment**: Planners use actual agent workspaces, not invented paths
2. **Role-Based Task Distribution**: Tasks are assigned to agents with appropriate roles
3. **Project-Specific Context**: Each project sees only its linked agents
4. **Automatic Injection**: No manual configuration needed in prompts
5. **Backward Compatible**: Non-planner agents are unaffected

## Troubleshooting

### Context Not Appearing

1. Check that the agent workspace path contains "planner" (case-insensitive)
2. Verify the project has agents linked in `project_agents` table
3. Check that agents have roles defined in `workspace_roles` table
4. Look for log messages: "Injected agents context for planner agent"

### Empty Agent List

1. Verify agents are linked to the project via dashboard or API
2. Check the `project_agents` table has entries for the project
3. Ensure workspace paths are correct and exist

### Planner Not Using Agents

1. Verify the planner skill is loaded
2. Check that the SKILL.md includes the "Agent Assignment" section
3. Review the planner's output for workspace path usage

## Files Modified

1. ✅ `api/src/routes/projects.ts` - Added agents-context endpoint
2. ✅ `client/orchestrator/daemon_client.py` - Added get_project_agents_context() + logger import
3. ✅ `client/orchestrator/runner.py` - Added build_agent_context() and injection
4. ✅ `client/orchestrator/chat_runner.py` - Added agents context injection
5. ✅ `projects/agents-manager/agents/planner/.claude/skills/planning/SKILL.md` - Documentation (already complete)

## Summary

The feature is **fully implemented and ready to use**. Planner agents will automatically receive a list of available agents in their project, allowing them to generate accurate plans that reference the correct workspace paths for each task.

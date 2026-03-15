# Agents Context Feature - Implementation Summary

## Overview

This feature automatically injects a list of available agents into planner agent contexts, enabling planners to reference the correct agents when creating task assignments.

## What Was Implemented

### 1. API Endpoint (`/api/projects/:id/agents-context`)

**File:** `/root/projects/agents-manager/api/src/routes/projects.ts`

A new GET endpoint that returns all agents linked to a project with their roles and workspace paths.

**Response Format:**
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

### 2. DaemonClient Method (`get_project_agents_context`)

**File:** `/root/projects/agents-manager/client/orchestrator/daemon_client.py`

An async method that fetches the agents list and formats it as a markdown string for injection into prompts.

**Format:**
```markdown
## Available Agents for this Project

- **frontend-dev** (role: `coder`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/frontend-dev`
- **api-tester** (role: `tester`)
  workspace: `/root/projects/agents-manager/projects/myapp/agents/api-tester`

When creating task assignments, use the workspace paths above. Match task type to agent role: coders for implementation, reviewers for validation, testers for test suites, etc.
```

### 3. Workflow Runner Integration

**File:** `/root/projects/agents-manager/client/orchestrator/runner.py`

- Added `build_agent_context()` helper function to detect planner agents and fetch agents context
- Modified `run_task()` to inject agents context before executing planner tasks
- Added `get_plan()` method to DaemonClient to fetch plan details (including project_id)

### 4. Chat Runner Integration

**File:** `/root/projects/agents-manager/client/orchestrator/chat_runner.py`

- Updated `run_chat_turn()` to accept optional `client` and `project_id` parameters
- Injects agents context for planner agents before passing messages to the SDK

**File:** `/root/projects/agents-manager/client/main.py`

- Updated the call site to pass `client` and `project_id` to `run_chat_turn()`

### 5. Planner Skill Documentation

**File:** `/root/projects/agents-manager/projects/agents-manager/agents/planner/.claude/skills/planning/SKILL.md`

Added comprehensive "Agent Assignment" section with:
- Explanation of how to use the injected agents context
- Description of each agent role (planner, coder, reviewer, tester, debugger, devops, generic)
- Best practices for task assignment
- Example usage

## How It Works

### Workflow Execution

1. User creates a plan using the dashboard or API
2. The plan includes a `project_id`
3. When the plan is executed, the runner checks each task
4. If a task uses a planner agent (detected by "planner" in workspace path):
   - The runner fetches the list of agents for that project
   - The agents context is injected at the beginning of the task prompt
   - The planner receives this context and can reference the available agents

### Chat Sessions

1. User starts a chat session with a planner agent
2. The session includes a `project_id`
3. Before each message is sent to the SDK:
   - The system checks if the workspace is a planner
   - If yes, fetches the agents context for the project
   - Injects the context at the beginning of the user's message

## Usage Examples

### Example 1: Creating a Plan with Multiple Agents

Given a project with:
- `frontend-dev` (coder role)
- `api-reviewer` (reviewer role)
- `e2e-tester` (tester role)

When the planner creates a plan, it will see:
```markdown
## Available Agents for this Project

- **frontend-dev** (role: `coder`)
  workspace: `/root/projects/myapp/agents/frontend-dev`
- **api-reviewer** (role: `reviewer`)
  workspace: `/root/projects/myapp/agents/api-reviewer`
- **e2e-tester** (role: `tester`)
  workspace: `/root/projects/myapp/agents/e2e-tester`
```

The planner can then create tasks like:
```json
{
  "id": "implement-feature",
  "name": "Implement new feature",
  "workspace": "/root/projects/myapp/agents/frontend-dev",
  "cwd": "/root/projects/myapp"
},
{
  "id": "review-code",
  "name": "Review implementation",
  "workspace": "/root/projects/myapp/agents/api-reviewer",
  "depends_on": ["implement-feature"]
},
{
  "id": "run-tests",
  "name": "Run E2E tests",
  "workspace": "/root/projects/myapp/agents/e2e-tester",
  "depends_on": ["review-code"]
}
```

### Example 2: Chat with Planner Agent

User message to planner agent:
```
"Create a feature that adds user authentication"
```

Planner receives (with context injected):
```markdown
## Available Agents for this Project

- **backend-dev** (role: `coder`)
  workspace: `/root/projects/myapp/agents/backend-dev`
- **frontend-dev** (role: `coder`)
  workspace: `/root/projects/myapp/agents/frontend-dev`
- **security-reviewer** (role: `reviewer`)
  workspace: `/root/projects/myapp/agents/security-reviewer`

---

Create a feature that adds user authentication
```

The planner can now reference these agents in its response.

## Testing

A test script is provided at `/root/projects/agents-manager/test_agents_context.py`.

To run:
```bash
# Make sure the API is running
cd /root/projects/agents-manager/api && npm run dev

# In another terminal, run the test
cd /root/projects/agents-manager
python3 test_agents_context.py
```

## Agent Roles

| Role | Description | Example Tasks |
|------|-------------|---------------|
| **planner** | Planning and analysis | Creating plans, analyzing requirements |
| **coder** | Implementation | Writing, editing, refactoring code |
| **reviewer** | Validation | Code review, quality checks, security audit |
| **tester** | Testing | Creating test suites, running tests |
| **debugger** | Troubleshooting | Fixing bugs, diagnosing issues |
| **devops** | Infrastructure | Deployment, CI/CD, configuration |
| **generic** | General purpose | Any task that doesn't fit other roles |

## Benefits

1. **No Hardcoded Paths**: Planners don't need to know workspace paths in advance
2. **Dynamic Agent Discovery**: When new agents are added to a project, planners automatically see them
3. **Role-Based Assignment**: Planners can match tasks to agents by role
4. **Consistent Context**: Both workflow and chat sessions use the same agent context format
5. **Documentation**: Planner skill documentation includes best practices for agent assignment

## Future Enhancements

Possible improvements:
- Add agent capabilities/specialties to the context (e.g., "Python expert", "React specialist")
- Include agent availability status (busy/idle)
- Add support for agent preferences (e.g., "preferred for frontend tasks")
- Include agent performance metrics (success rate, average execution time)

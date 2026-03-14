# Agents Context Feature - Quick Start Guide

## Prerequisites

1. **API Running**: Make sure the API server is running
   ```bash
   cd /root/projects/agents-manager/api && npm run dev
   ```

2. **Agents Linked**: Ensure agents are linked to your project via the dashboard or API

## Testing the Feature

### Step 1: Test the API Endpoint

```bash
# Get your auth token (default for dev)
TOKEN="dev-token-change-in-production"

# Get list of projects
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/projects | jq .

# Get agents for a specific project (replace {project_id})
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/projects/{project_id}/agents-context | jq .
```

### Step 2: Create a Plan with a Planner Agent

1. **Link a planner agent to your project** (via dashboard or API)
2. **Link other agents** (coders, reviewers, testers) to the same project
3. **Create a plan** that uses the planner agent
4. **Execute the plan** - the planner will automatically receive the agents context

### Step 3: Chat with a Planner Agent

1. **Start a chat session** with a planner agent
2. **Set the project_id** when creating the session
3. **Send a message** - the planner will automatically see available agents

## Example: Setting Up a Multi-Agent Project

### 1. Create a Project

```bash
TOKEN="dev-token-change-in-production"

# Create project
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"myapp","description":"Multi-agent demo"}' \
  http://localhost:3000/api/projects | jq .
```

### 2. Create Agents (via dashboard or manually)

For each agent, create a workspace with the appropriate role:

```bash
AGENT_CLIENT_PATH="/root/projects/agents-manager/projects"
PROJECT_NAME="myapp"

# Create agents directory
mkdir -p "$AGENT_CLIENT_PATH/$PROJECT_NAME/agents"

# Create planner agent
mkdir -p "$AGENT_CLIENT_PATH/$PROJECT_NAME/agents/planner/.claude"
# (Add CLAUDE.md, settings.local.json, skills/)

# Create coder agent
mkdir -p "$AGENT_CLIENT_PATH/$PROJECT_NAME/agents/coder/.claude"
# (Add CLAUDE.md, settings.local.json, skills/)

# Create reviewer agent
mkdir -p "$AGENT_CLIENT_PATH/$PROJECT_NAME/agents/reviewer/.claude"
# (Add CLAUDE.md, settings.local.json, skills/)
```

### 3. Link Agents to Project

```bash
PROJECT_ID="<from step 1>"

# Link planner agent
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_path\":\"$AGENT_CLIENT_PATH/$PROJECT_NAME/agents/planner\"}" \
  http://localhost:3000/api/projects/$PROJECT_ID/agents

# Link coder agent
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_path\":\"$AGENT_CLIENT_PATH/$PROJECT_NAME/agents/coder\"}" \
  http://localhost:3000/api/projects/$PROJECT_ID/agents

# Link reviewer agent
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_path\":\"$AGENT_CLIENT_PATH/$PROJECT_NAME/agents/reviewer\"}" \
  http://localhost:3000/api/projects/$PROJECT_ID/agents
```

### 4. Set Agent Roles (via dashboard or SQL)

```bash
# Via dashboard: Go to /agents, click on agent, edit role
# Or via SQL:
sqlite3 /root/projects/agents-manager/api/data/database.db \
  "INSERT OR REPLACE INTO workspace_roles (workspace_path, role) VALUES
  ('/root/projects/agents-manager/projects/myapp/agents/planner', 'planner'),
  ('/root/projects/agents-manager/projects/myapp/agents/coder', 'coder'),
  ('/root/projects/agents-manager/projects/myapp/agents/reviewer', 'reviewer');"
```

### 5. Verify Agents Context

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/projects/$PROJECT_ID/agents-context | jq .
```

Expected output:
```json
{
  "data": [
    {
      "name": "planner",
      "role": "planner",
      "workspace_path": "/root/projects/agents-manager/projects/myapp/agents/planner",
      "cwd": null
    },
    {
      "name": "coder",
      "role": "coder",
      "workspace_path": "/root/projects/agents-manager/projects/myapp/agents/coder",
      "cwd": null
    },
    {
      "name": "reviewer",
      "role": "reviewer",
      "workspace_path": "/root/projects/agents-manager/projects/myapp/agents/reviewer",
      "cwd": null
    }
  ],
  "error": null
}
```

### 6. Create a Plan Using the Planner

Create a plan with `project_id` set to your project ID. The planner will automatically see the available agents and can assign tasks to them.

## Troubleshooting

### Issue: Planner doesn't see agents

**Check:**
1. Are agents linked to the project? (Check `project_agents` table)
2. Do agents have roles set? (Check `workspace_roles` table)
3. Is the workspace path correct in `project_agents`?

### Issue: Empty agents context

**Check:**
1. Verify the endpoint returns data: `GET /api/projects/:id/agents-context`
2. Check the DaemonClient logs for fetch errors
3. Ensure the plan/session has a `project_id`

### Issue: Wrong agent names

**Cause:** Agent names are extracted from the workspace path.

**Solution:** Ensure your workspace paths follow the expected structure:
```
/root/projects/agents-manager/projects/{project}/agents/{agent-name}/
```

## Files Modified

- `/root/projects/agents-manager/api/src/routes/projects.ts` - Added agents-context endpoint
- `/root/projects/agents-manager/client/orchestrator/daemon_client.py` - Added get_project_agents_context method
- `/root/projects/agents-manager/client/orchestrator/runner.py` - Inject context in workflow tasks
- `/root/projects/agents-manager/client/orchestrator/chat_runner.py` - Inject context in chat sessions
- `/root/projects/agents-manager/client/main.py` - Pass client/project_id to chat runner
- `/root/projects/agents-manager/projects/agents-manager/agents/planner/.claude/skills/planning/SKILL.md` - Added documentation

## Support

For issues or questions:
1. Check the implementation summary: `AGENTS_CONTEXT_FEATURE.md`
2. Run the test script: `python3 test_agents_context.py`
3. Check logs in `/root/projects/agents-manager/api/` and `/root/projects/agents-manager/client/`

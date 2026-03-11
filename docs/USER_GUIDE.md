# User Guide

## Starting the platform

```bash
bash start.sh
```

This starts the API (port 3000), dashboard (port 5173), and agent daemon. Open http://localhost:5173.

> **Requirement**: the llm-router must be running separately on port 8083 for agent authentication to work. If you use direct Anthropic API, run `claude login` before starting.

## Creating a Project

1. Go to **Projects** in the sidebar
2. Click **New Project** and enter name and description
3. Inside the project, click **Add Environment**
4. Fill in:
   - **Name**: e.g. `Development`
   - **Type**: `local-wsl`, `local-windows`, or `ssh`
   - **Project Path**: where your project files are (e.g. `/root/projects/charhub`)
5. The agent workspace is created automatically with CLAUDE.md and settings.local.json

## Managing Agents

1. Go to **Agents** in the sidebar
2. Each agent corresponds to a workspace folder with Claude configuration
3. Click an agent to edit:
   - **CLAUDE.md** — agent identity, instructions and context
   - **Settings** — environment variables and permission rules
   - **Skills** — on-demand skill files (SKILL.md)
   - **Sub-agents** — specialized agents this agent can delegate to

## Creating a Plan

### Via UI
1. Go to **Plans** and click **New Plan**
2. Enter a plan name
3. Add tasks:
   - **Prompt**: what the agent should do
   - **Agent Workspace**: who executes (select from registered agents)
   - **Environment**: where to execute (select from registered environments)
   - **Depends on**: task IDs this task waits for before starting
4. Click **Create Plan**

### Via JSON Import
1. Click **Import JSON** on the Plans page
2. Upload a `.json` file with this structure:
```json
{
  "name": "Plan name",
  "tasks": [
    {
      "id": "t1",
      "name": "Task name",
      "prompt": "What the agent should do",
      "cwd": "/root/projects/my-project",
      "workspace": "/root/projects/agents-manager/projects/my-project/dev/agent-coder",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
```

## Monitoring Execution

- **Plan detail page**: shows live logs streamed via SSE while running
- **Force Stop**: red button appears on running plans — use when daemon has crashed
- **Retry**: re-queues a failed or completed plan
- **Export**: downloads the plan as a JSON template

## Approval Queue

When an agent requests human approval for a sensitive operation:
1. A badge appears on the **Approvals** sidebar link
2. Open **Approvals** to see the pending request
3. Review the operation and click **Approve** or **Deny**
4. The agent continues (or stops) based on your decision

Approvals auto-timeout after 10 minutes (configurable via `APPROVAL_TIMEOUT_MINUTES` in `api/.env`).

## Workflows & Metrics

The **Workflows** page shows:
- Total plans, success rate, average duration
- Last 7 days activity
- Full execution history table with links to each plan

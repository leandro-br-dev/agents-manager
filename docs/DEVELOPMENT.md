# Development

## Project Structure

```
agents-manager/
├── api/                    # Express.js backend
│   ├── src/
│   │   ├── index.ts        # App entry point, DB init, middleware
│   │   ├── db/             # Database setup and migrations
│   │   ├── middleware/     # Auth middleware
│   │   └── routes/         # API route handlers
│   ├── data/               # SQLite database (gitignored)
│   └── package.json
├── dashboard/              # React frontend
│   ├── src/
│   │   ├── api/            # React Query hooks per domain
│   │   ├── pages/          # Page components
│   │   ├── components/     # Shared components
│   │   └── router.tsx      # Route definitions
│   └── package.json
├── client/                 # Python daemon
│   ├── orchestrator/       # Core execution logic
│   ├── tests/              # pytest test suite
│   ├── main.py             # CLI entry point
│   └── requirements.txt
├── projects/               # Agent workspaces (gitignored)
├── docs/                   # Documentation
├── start.sh                # Unified start script
└── package.json            # Root scripts
```

## Manual Start

```bash
# API
cd api && npm run dev

# Dashboard
cd dashboard && npm run dev

# Daemon
cd client && source venv/bin/activate
export AGENTS_MANAGER_URL=http://localhost:3000
export AGENTS_MANAGER_TOKEN=dev-token-change-in-production
python main.py --daemon
```

## Environment Variables

### api/.env
```
AGENTS_MANAGER_TOKEN=dev-token-change-in-production
AGENT_CLIENT_PATH=/root/projects/agents-manager/projects
APPROVAL_TIMEOUT_MINUTES=10
PLAN_TIMEOUT_MINUTES=10
PORT=3000
ALLOWED_ORIGINS=         # comma-separated, leave empty for localhost only
```

### dashboard/.env
```
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TOKEN=dev-token-change-in-production
```

## Running Tests

```bash
# Python client tests
cd client && source venv/bin/activate
python -m pytest tests/ -v

# TypeScript build check
cd api && npm run build
cd dashboard && npm run build
```

## Database

SQLite at `api/data/database.db`. Tables:

| Table | Description |
|-------|-------------|
| `plans` | Plans with tasks (JSON), status, client_id |
| `plan_logs` | Log entries per plan/task |
| `approvals` | Pending/resolved approval requests |
| `projects` | Project definitions |
| `environments` | Environments per project |

Schema is auto-created on first API start via `db.exec()` in `src/db/index.ts`.

## Adding a New API Route

1. Create `api/src/routes/myroute.ts`
2. Register in `api/src/index.ts`: `app.use('/api/myroute', myrouteRouter)`
3. Add React Query hook in `dashboard/src/api/myroute.ts`
4. Use in a page component

## Agent Workspace Structure

Created automatically when an environment is added to a project:

```
projects/<project-slug>/<env-slug>/agent-coder/
├── CLAUDE.md                     # Agent instructions (edit via /agents)
└── .claude/
    ├── settings.local.json       # Permissions + env vars
    ├── skills/
    │   └── <skill-name>/
    │       └── SKILL.md
    └── agents/
        └── <agent-name>.md
```

Key settings.local.json fields:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8083"
  },
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob"],
    "deny": [],
    "additionalDirectories": ["/root/projects/my-project"]
  }
}
```

# Architecture

## Overview

agents-manager is a three-component system:

```
┌─────────────────────────────────────────────┐
│              dashboard (React)               │
│  Plans · Workflows · Projects · Agents       │
│  Approvals · Settings                        │
└──────────────────┬──────────────────────────┘
                   │ HTTP + SSE
┌──────────────────▼──────────────────────────┐
│                api (Express)                 │
│  SQLite · REST endpoints · SSE streaming     │
└──────────────────┬──────────────────────────┘
                   │ HTTP polling (5s)
┌──────────────────▼──────────────────────────┐
│               client (Python)                │
│  Daemon · Orchestrator · Claude SDK runner   │
└──────────────────┬──────────────────────────┘
                   │ subprocess
┌──────────────────▼──────────────────────────┐
│           Claude Code CLI                    │
│  Executes agent tasks in project workspaces  │
└─────────────────────────────────────────────┘
```

## Components

### api/
Express.js + SQLite backend on port 3000.

| Route | Description |
|-------|-------------|
| `GET/POST /api/plans` | Plan management |
| `GET /api/plans/:id/logs/stream` | SSE log streaming |
| `GET /api/plans/metrics` | Execution statistics |
| `GET/POST /api/approvals` | Approval queue |
| `POST /api/approvals/:id/respond` | Approve or deny |
| `GET/POST /api/projects` | Projects and environments |
| `GET/POST /api/workspaces` | Agent workspace management |
| `GET/POST /api/daemon` | Daemon process control |

### dashboard/
React 19 + TypeScript + Vite + Tailwind + React Query on port 5173.

| Page | Purpose |
|------|---------|
| `/` | Plans list with status, import/export JSON |
| `/plans/:id` | Plan detail with live SSE logs |
| `/workflows` | Execution history and metrics |
| `/approvals` | Pending approval queue |
| `/projects` | Projects and environments |
| `/agents` | Agent workspaces (CLAUDE.md, settings, skills) |
| `/settings` | API status and daemon control |

### client/
Python daemon using Claude Agent SDK.

| File | Purpose |
|------|---------|
| `main.py` | CLI entry point (`--daemon` mode) |
| `orchestrator/plan.py` | Task/Plan dataclasses, dependency wave resolver |
| `orchestrator/runner.py` | Executes tasks via Claude SDK, captures logs |
| `orchestrator/daemon_client.py` | HTTP client for agents-manager API |
| `orchestrator/logger.py` | Colored terminal output |

### projects/
Local agent workspaces. Gitignored — machine-specific.

```
projects/
└── <project-slug>/
    └── <env-slug>/
        └── agent-coder/
            ├── CLAUDE.md                 ← agent identity
            └── .claude/
                ├── settings.local.json   ← env vars + permissions
                ├── skills/<n>/SKILL.md
                └── agents/<n>.md
```

## Plan Execution Flow

```
1. User creates plan (UI or JSON import)
2. Plan status → pending
3. Daemon polls GET /api/plans/pending every 5s
4. Daemon claims plan → status running
5. Tasks resolved into dependency waves
6. Wave tasks execute in parallel via Claude SDK
7. Logs streamed to API → SSE → dashboard
8. If task requires approval → paused until user responds
9. Plan completes → status success or failed
```

## Key Concepts

| Concept | Definition |
|---------|------------|
| **Project** | Logical grouping (e.g. CharHub, InvestScope) |
| **Environment** | Execution instance: dev/staging/prod, local/ssh |
| **Agent** | CLAUDE.md + .claude/ config folder (who executes) |
| **Working directory (cwd)** | Where project files are (what gets modified) |
| **Plan** | Named collection of tasks with dependencies |
| **Wave** | Group of tasks with no mutual dependencies (run in parallel) |

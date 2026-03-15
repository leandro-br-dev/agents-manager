# agents-manager

AI agent orchestration platform. Create, execute and monitor multi-agent workflows from your browser.

Built for developers who use Claude Code as the execution engine and want a structured way to manage complex plans with multiple specialized agents.

## Features

- **Plan builder** — create multi-task plans with dependencies via UI or JSON import/export
- **Projects & Environments** — organize work by project (CharHub, InvestScope...) and environment (dev/staging/ssh)
- **Agent management** — configure agents with CLAUDE.md, skills, sub-agents and permissions per environment
- **Live execution logs** — real-time SSE streaming while agents run
- **Approval queue** — pause execution and request human approval for sensitive operations
- **Daemon management** — start/stop the agent daemon directly from the Settings page
- **Execution history** — metrics and full history on the Workflows page

## Quick Start

```bash
git clone git@github.com:leandro-br-dev/agents-manager.git
cd agents-manager
npm run install:all
bash start.sh
```

Open **http://localhost:5173**

## Requirements

- Node.js 18+
- Python 3.11+
- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed and authenticated
- Optional: [llm-router](https://github.com/leandro-br-dev/llm-router) for local LLM routing

## Documentation

- [User Guide](docs/USER_GUIDE.md) — comprehensive guide covering getting started, architecture, development setup, and UI patterns
- [AUTO_MOVE_COMPLETE.md](docs/AUTO_MOVE_COMPLETE.md) — technical documentation for advanced auto-move features
- [AUTO_MOVE_FEATURE.md](docs/AUTO_MOVE_FEATURE.md) — feature guides and usage examples

## License

MIT

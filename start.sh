#!/bin/bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ''
echo '██████████████████████████████████████'
echo '  agents-manager'
echo '██████████████████████████████████████'
echo ''

# Verificar dependências
command -v node >/dev/null || { echo 'ERROR: node not found'; exit 1; }
command -v python3 >/dev/null || { echo 'ERROR: python3 not found'; exit 1; }

# Verificar autenticação do Claude CLI
echo '→ Checking Claude CLI authentication...'
if command -v claude >/dev/null 2>&1; then
  # Tentar um comando simples para ver se está autenticado
  CLAUDE_AUTH=$(claude --version 2>&1)
  if echo "$CLAUDE_AUTH" | grep -q 'oauth\|expired\|unauthorized' 2>/dev/null; then
    echo '  ⚠ Claude CLI may need re-authentication. Run: claude login'
  else
    echo "  ✓ Claude CLI found ($CLAUDE_AUTH)"
  fi
else
  echo '  ⚠ claude CLI not found in PATH'
fi

# Configurar env padrão se não existir
if [ ! -f "$ROOT/api/.env" ]; then
  echo 'Creating api/.env with defaults...'
  cat > "$ROOT/api/.env" << 'EOF'
AGENTS_MANAGER_TOKEN=dev-token-change-in-production
AGENT_CLIENT_PATH=/root/projects/agents-manager/projects
APPROVAL_TIMEOUT_MINUTES=10
PORT=3000
EOF
fi

# Criar venv do client se não existir
if [ ! -d "$ROOT/client/venv" ]; then
  echo 'Creating Python venv for client...'
  python3 -m venv "$ROOT/client/venv"
  "$ROOT/client/venv/bin/pip" install -r "$ROOT/client/requirements.txt" -q
fi

# Função cleanup
cleanup() {
  echo ''
  echo 'Shutting down...'
  kill $API_PID $DASHBOARD_PID $DAEMON_PID 2>/dev/null
  wait 2>/dev/null
  echo 'Done.'
}
trap cleanup EXIT INT TERM

# Iniciar API
echo '→ Starting API on port 3000...'
cd "$ROOT/api" && npm run dev > /tmp/agents-manager-api.log 2>&1 &
API_PID=$!
sleep 3

# Verificar API
curl -s http://localhost:3000/api/plans -H "Authorization: Bearer dev-token-change-in-production" > /dev/null \
  && echo '  ✓ API running' \
  || echo '  ⚠ API may still be starting...'

# Iniciar Dashboard
echo '→ Starting Dashboard on port 5173...'
cd "$ROOT/dashboard" && npm run dev > /tmp/agents-manager-dashboard.log 2>&1 &
DASHBOARD_PID=$!
sleep 2

# Iniciar Daemon
echo '→ Starting Agent Daemon...'
cd "$ROOT/client"
source venv/bin/activate
export AGENTS_MANAGER_URL="http://localhost:3000"
export AGENTS_MANAGER_TOKEN="$(grep AGENTS_MANAGER_TOKEN $ROOT/api/.env | cut -d= -f2)"
export AGENT_CLIENT_PATH="$ROOT/projects"
python main.py --daemon &
DAEMON_PID=$!
deactivate

echo ''
echo '✓ All services started:'
echo '  Dashboard → http://localhost:5173'
echo '  API       → http://localhost:3000'
echo '  Daemon    → polling for plans'
echo ''
echo 'Press Ctrl+C to stop all services'
echo ''

wait $DAEMON_PID

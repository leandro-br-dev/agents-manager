import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { PageHeader, Button, Card } from '@/components';

function ApiStatusBadge() {
  const { isError, isLoading } = useQuery({
    queryKey: ['api-health'],
    queryFn: () => apiFetch<any>('/api/plans'),
    retry: false,
    refetchInterval: 30000,
  });

  if (isLoading) return <span className="text-xs text-gray-400">Checking...</span>;

  if (isError) return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <span className="h-2 w-2 rounded-full bg-red-500" /> Unreachable
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <span className="h-2 w-2 rounded-full bg-green-500" /> Connected
    </span>
  );
}

// Hooks para daemon
function useDaemonStatus() {
  return useQuery({
    queryKey: ['daemon', 'status'],
    queryFn: () => apiFetch<{ status: string; pid: number | null; logs: string[] }>('/api/daemon/status'),
    refetchInterval: 5000,
  })
}

function useStartDaemon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/daemon/start', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daemon'] }),
  })
}

function useStopDaemon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/daemon/stop', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daemon'] }),
  })
}

export default function SettingsPage() {
  const { data: daemon } = useDaemonStatus()
  const startDaemon = useStartDaemon()
  const stopDaemon = useStopDaemon()

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <PageHeader
        title="Settings"
        description="Configure your API connection and agent daemon"
      />

      {/* Seção: Conexão com a API */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">API Connection</h2>
        <Card className="bg-gray-50">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">API URL</span>
            <code className="text-sm font-mono text-gray-900">
              {import.meta.env.VITE_API_URL || 'http://localhost:3000'}
            </code>
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-sm text-gray-600">Status</span>
            <ApiStatusBadge />
          </div>
        </Card>
      </section>

      {/* Seção: Agent Daemon */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Agent Daemon</h2>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${
                daemon?.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className="text-sm font-medium">
                {daemon?.status === 'running' ? `Running (PID ${daemon.pid})` : 'Stopped'}
              </span>
            </div>
            <div className="flex gap-2">
              {daemon?.status !== 'running' ? (
                <Button
                  onClick={() => startDaemon.mutate()}
                  disabled={startDaemon.isPending}
                  loading={startDaemon.isPending}
                  className="bg-green-600 hover:bg-green-700 border-green-600"
                >
                  Start
                </Button>
              ) : (
                <Button
                  onClick={() => stopDaemon.mutate()}
                  disabled={stopDaemon.isPending}
                  loading={stopDaemon.isPending}
                  variant="danger"
                >
                  Stop
                </Button>
              )}
            </div>
          </div>
          {daemon?.logs && daemon.logs.length > 0 && (
            <pre className="bg-gray-900 text-gray-100 rounded p-3 text-xs max-h-40 overflow-y-auto">
              {daemon.logs.slice(-20).join('\n')}
            </pre>
          )}
        </Card>
      </section>

      {/* Seção: Agent Client */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Agent Client</h2>
        <Card className="bg-gray-50">
          <p className="text-sm text-green-600">
            <strong>✓ Managed via API</strong> — O daemon agora é controlado pela interface acima.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Se precisar iniciar manualmente para debug, o script está em: <code>client/main.py</code>
          </p>
        </Card>
      </section>

      {/* Seção: Workspaces path */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Workspaces</h2>
        <Card className="bg-gray-50">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Base path</span>
            <code className="text-sm font-mono text-gray-900">
              AGENT_CLIENT_PATH env var
            </code>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Defina AGENT_CLIENT_PATH no .env da API para apontar para o diretório de projetos.
            Padrão: /root/projects/agent-client/projects
          </p>
        </Card>
      </section>
    </div>
  );
}

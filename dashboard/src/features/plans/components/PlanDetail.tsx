import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useGetPlan, useExecutePlan, useDeletePlan } from '@/api/plans';
import { useLogStream } from '../hooks/useLogStream';
import { cn } from '@/lib/utils';
import { Trash2, Download, StopCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  status: keyof typeof statusColors;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status]
      )}
    >
      {status}
    </span>
  );
}

export function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading: planLoading, error: planError } = useGetPlan(id || '');
  const executeMutation = useExecutePlan();
  const deletePlan = useDeletePlan();
  const queryClient = useQueryClient();
  const forceStop = useMutation({
    mutationFn: (planId: string) =>
      apiFetch(`/api/plans/${planId}/force-stop`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['plan', id] })
    },
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    if (!plan) return;
    const exportData = {
      name: plan.name,
      tasks: Array.isArray(plan.tasks) ? plan.tasks : JSON.parse(plan.tasks as string),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Use SSE streaming for logs
  const { logs, streamStatus } = useLogStream(id || '', !!id);

  const isRunning = plan?.status === 'running';

  // Auto-scroll to bottom when running or streaming
  useEffect(() => {
    if ((isRunning || streamStatus === 'streaming') && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning, streamStatus]);

  if (planLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading plan...</div>
      </div>
    );
  }

  if (planError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading plan: {(planError as Error).message}</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Plan not found</div>
      </div>
    );
  }

  const handleExecute = () => {
    if (id) {
      executeMutation.mutate(id);
    }
  };

  // Defensive parsing for tasks field
  const tasks = Array.isArray(plan.tasks)
    ? plan.tasks
    : JSON.parse(plan.tasks as string);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Plans
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
            </div>
            <StatusBadge status={plan.status} />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
              title="Download plan as JSON"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            {plan.status === 'pending' && (
              <button
                disabled
                className="rounded-md bg-gray-400 px-4 py-2 text-sm font-semibold text-white shadow-sm cursor-not-allowed"
              >
                Awaiting daemon
              </button>
            )}
            {plan.status === 'running' && (
  <button
    onClick={() => {
      if (confirm('Force stop this plan? This will mark it as failed immediately.')) {
        forceStop.mutate(plan.id)
      }
    }}
    disabled={forceStop.isPending}
    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 disabled:opacity-50"
    title="Force stop - use when daemon has crashed"
  >
    <StopCircle className="h-4 w-4" />
    {forceStop.isPending ? 'Stopping...' : 'Force Stop'}
  </button>
)}
            {(plan.status === 'failed' || plan.status === 'success') && (
              <button
                onClick={handleExecute}
                disabled={executeMutation.isPending}
                className={cn(
                  'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                  'hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {executeMutation.isPending ? 'Re-queuing...' : 'Retry Plan'}
              </button>
            )}
            {plan.status !== 'running' && (
              confirmDelete ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Excluir permanentemente?</span>
                  <button
                    onClick={async () => {
                      await deletePlan.mutateAsync(plan.id);
                      navigate('/');
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4">Plan Information</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Client ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{plan.client_id || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <StatusBadge status={plan.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {plan.created_at ? new Date(plan.created_at).toLocaleString() : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Started</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {plan.started_at ? new Date(plan.started_at).toLocaleString() : 'Not started'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Completed</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {plan.completed_at ? new Date(plan.completed_at).toLocaleString() : 'Not completed'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4">Tasks</h2>
          <dl className="space-y-4">
            {tasks.map((task: any, index: number) => (
              <div key={task.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <dt className="text-sm font-medium text-gray-900">
                    {index + 1}. {task.name}
                  </dt>
                  <dd className="text-xs text-gray-500">ID: {task.id}</dd>
                </div>
                {task.prompt && (
                  <dd className="text-sm text-gray-600 mb-2">{task.prompt}</dd>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>cwd: {task.cwd}</span>
                  <span>workspace: {task.workspace}</span>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Result */}
      {plan.result && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4">Result</h2>
            <div className="bg-gray-50 rounded-md p-4">
              <pre className="text-sm text-gray-900 whitespace-pre-wrap">{plan.result}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold leading-7 text-gray-900">Logs</h2>
            {streamStatus === 'streaming' && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <span className="animate-pulse">●</span> Live
              </span>
            )}
            {streamStatus === 'done' && (
              <span className="text-xs text-gray-400">✓ Completed</span>
            )}
            {streamStatus === 'connecting' && (
              <span className="text-xs text-blue-500">Connecting...</span>
            )}
            {streamStatus === 'error' && (
              <span className="text-xs text-red-500">Connection error</span>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="text-gray-500 text-sm">No logs available</div>
          ) : (
            <div className="bg-gray-900 rounded-md p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.map((log) => (
                <div key={log.id} className={`mb-1 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'debug' ? 'text-gray-400' :
                  'text-gray-100'
                }`}>
                  <span className="text-gray-400 mr-2">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <span className="text-blue-400 mr-2">[{log.task_id}]</span>
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

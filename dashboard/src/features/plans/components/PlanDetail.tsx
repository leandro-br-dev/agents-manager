import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useGetPlan, useExecutePlan, useDeletePlan, useResumePlan, useApprovePlan, useEditPlan } from '@/api/plans';
import { useLogStream } from '../hooks/useLogStream';
import { cn } from '@/lib/utils';
import { Trash2, Download, StopCircle, RotateCcw, CheckCircle, Pencil } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  awaiting_approval: 'bg-amber-100 text-amber-800',
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

interface EditPlanModalProps {
  plan: any;
  onClose: () => void;
}

function EditPlanModal({ plan, onClose }: EditPlanModalProps) {
  const [name, setName] = useState(plan.name);
  const [tasks, setTasks] = useState<any[]>(
    Array.isArray(plan.tasks) ? plan.tasks : []
  );
  const editPlan = useEditPlan();

  const handleSave = async () => {
    await editPlan.mutateAsync({ id: plan.id, name, tasks });
    onClose();
  };

  const updateTask = (index: number, field: string, value: string) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const moveTask = (index: number, dir: 'up' | 'down') => {
    const next = [...tasks];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setTasks(next);
  };

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const addTask = () => {
    setTasks(prev => [...prev, {
      id: `task-${Date.now()}`,
      name: '',
      prompt: '',
      cwd: '',
      workspace: '',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
      permission_mode: 'acceptEdits',
      depends_on: [],
    }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-900">Edit Workflow</h3>

        {/* Nome */}
        <Input
          label="Plan name"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Tasks */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {tasks.map((task, i) => (
            <div key={task.id || i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Task {i + 1}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveTask(i, 'up')} disabled={i === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
                  <button onClick={() => moveTask(i, 'down')} disabled={i === tasks.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
                  <button onClick={() => removeTask(i)}
                    className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Input label="Name" value={task.name}
                onChange={e => updateTask(i, 'name', e.target.value)} />
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Prompt</label>
                <textarea
                  value={task.prompt}
                  onChange={e => updateTask(i, 'prompt', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <Input label="cwd" value={task.cwd}
                onChange={e => updateTask(i, 'cwd', e.target.value)} />
              <Input label="workspace" value={task.workspace}
                onChange={e => updateTask(i, 'workspace', e.target.value)} />
            </div>
          ))}
          <button onClick={addTask}
            className="w-full border border-dashed border-gray-300 rounded-lg p-2 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors">
            + Add task
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={editPlan.isPending}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: plan, isLoading: planLoading, error: planError } = useGetPlan(id || '');
  const executeMutation = useExecutePlan();
  const deletePlan = useDeletePlan();
  const resumePlan = useResumePlan();
  const approvePlan = useApprovePlan();
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
  const [confirmForceStop, setConfirmForceStop] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Determine back navigation from router state
  const backTo = location.state?.from || '/';
  const backLabel = location.state?.fromLabel || 'Plans';

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
              <button
                onClick={() => navigate(backTo)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← {backLabel}
              </button>
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
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  title="Edit this plan"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <button
                  disabled
                  className="rounded-md bg-gray-400 px-4 py-2 text-sm font-semibold text-white shadow-sm cursor-not-allowed"
                >
                  Awaiting daemon
                </button>
              </>
            )}
            {plan.status === 'awaiting_approval' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  title="Edit this plan"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <button
                  onClick={() => approvePlan.mutate(plan.id)}
                  disabled={approvePlan.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Approve and execute this plan"
                >
                  <CheckCircle className="h-4 w-4" />
                  {approvePlan.isPending ? 'Approving...' : 'Approve & Run'}
                </button>
              </>
            )}
            {plan.status === 'running' && (
              <button
                onClick={() => setConfirmForceStop(true)}
                disabled={forceStop.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 disabled:opacity-50"
                title="Force stop - use when daemon has crashed"
              >
                <StopCircle className="h-4 w-4" />
                {forceStop.isPending ? 'Stopping...' : 'Force Stop'}
              </button>
            )}
            {(plan.status === 'failed' || plan.status === 'success') && (
              <>
                {plan.status === 'failed' && (
                  <button
                    onClick={() => resumePlan.mutate(plan.id)}
                    disabled={resumePlan.isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-600 text-sm rounded hover:bg-green-50',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title="Resume - skip completed tasks and continue from where it failed"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {resumePlan.isPending ? 'Resuming...' : 'Resume'}
                  </button>
                )}
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
              </>
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

      {/* Force Stop Confirmation Dialog */}
      <ConfirmDialog
        open={confirmForceStop}
        title="Force stop workflow?"
        description="The workflow will be marked as failed immediately. Running agents will not be interrupted but no new tasks will start."
        confirmLabel="Force Stop"
        variant="danger"
        onConfirm={() => {
          forceStop.mutate(plan.id);
          setConfirmForceStop(false);
        }}
        onCancel={() => setConfirmForceStop(false)}
        loading={forceStop.isPending}
      />

      {/* Edit Plan Modal */}
      {showEditModal && (
        <EditPlanModal
          plan={plan}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

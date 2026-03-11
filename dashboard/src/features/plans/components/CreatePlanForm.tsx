import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useCreatePlan, type Task } from '@/api/plans';
import { useGetWorkspaces } from '@/api/workspaces';
import { useGetAllEnvironments } from '@/api/projects';
import { cn } from '@/lib/utils';

interface TaskForm {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  workspace: string;
  env_context?: string;
  selectedEnvId?: string;
}

interface FormErrors {
  name?: string;
  tasks?: string[];
}

export function CreatePlanForm() {
  const navigate = useNavigate();
  const createMutation = useCreatePlan();
  const { data: workspaces = [] } = useGetWorkspaces();
  const { data: environments = [] } = useGetAllEnvironments();

  const [planName, setPlanName] = useState('');
  const [tasks, setTasks] = useState<TaskForm[]>([
    {
      id: crypto.randomUUID(),
      name: '',
      prompt: '',
      cwd: '',
      workspace: '',
    },
  ]);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!planName.trim()) {
      newErrors.name = 'Plan name is required';
    }

    const taskErrors: string[] = tasks.map((task) => {
      if (!task.name.trim()) return 'Task name is required';
      if (!task.prompt.trim()) return 'Task prompt is required';
      if (!task.cwd.trim()) return 'Working directory is required';
      if (!task.workspace.trim()) return 'Agent workspace is required';
      return '';
    });

    if (taskErrors.some((error) => error !== '')) {
      newErrors.tasks = taskErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const tasksToCreate: Task[] = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      prompt: task.prompt,
      cwd: task.cwd,
      workspace: task.workspace,
      env_context: task.env_context,
    }));

    createMutation.mutate(
      { name: planName, tasks: tasksToCreate },
      {
        onSuccess: (data) => {
          navigate(`/plans/${data.id}`);
        },
      }
    );
  };

  const addTask = () => {
    setTasks([
      ...tasks,
      {
        id: crypto.randomUUID(),
        name: '',
        prompt: '',
        cwd: '',
        workspace: '',
      },
    ]);
  };

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter((_, i) => i !== index));
    }
  };

  const updateTask = (index: number, field: keyof TaskForm, value: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[index][field] = value;
    setTasks(updatedTasks);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Plans
        </Link>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Plan</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Plan Name */}
            <div>
              <label htmlFor="planName" className="block text-sm font-medium text-gray-700">
                Plan Name *
              </label>
              <input
                type="text"
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className={cn(
                  'mt-1 block w-full rounded-md border-gray-300 shadow-sm',
                  'focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                  'px-3 py-2 border',
                  errors.name && 'border-red-500'
                )}
                placeholder="My awesome plan"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Tasks *
                </label>
                <button
                  type="button"
                  onClick={addTask}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Add Task
                </button>
              </div>

              <div className="space-y-6">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="border border-gray-300 rounded-md p-4 space-y-4 relative"
                  >
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTask(index)}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}

                    <h3 className="text-lg font-medium text-gray-900">Task {index + 1}</h3>

                    {errors.tasks?.[index] && (
                      <p className="text-sm text-red-600">{errors.tasks[index]}</p>
                    )}

                    <div>
                      <label
                        htmlFor={`task-name-${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Task Name *
                      </label>
                      <input
                        type="text"
                        id={`task-name-${index}`}
                        value={task.name}
                        onChange={(e) => updateTask(index, 'name', e.target.value)}
                        className={cn(
                          'mt-1 block w-full rounded-md border-gray-300 shadow-sm',
                          'focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                          'px-3 py-2 border',
                          errors.tasks?.[index] && 'border-red-500'
                        )}
                        placeholder="Build frontend components"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`task-prompt-${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Prompt *
                      </label>
                      <textarea
                        id={`task-prompt-${index}`}
                        rows={4}
                        value={task.prompt}
                        onChange={(e) => updateTask(index, 'prompt', e.target.value)}
                        className={cn(
                          'mt-1 block w-full rounded-md border-gray-300 shadow-sm',
                          'focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                          'px-3 py-2 border',
                          errors.tasks?.[index] && 'border-red-500'
                        )}
                        placeholder="Describe what this task should do..."
                      />
                    </div>

                    <div className="space-y-3">
                      {/* Agent Workspace - QUEM executa */}
                      <div>
                        <label
                          htmlFor={`task-workspace-${index}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Agent Workspace <span className="text-red-500">*</span>
                          <span className="text-xs text-gray-400 ml-1">— pasta com CLAUDE.md e .claude/</span>
                        </label>
                        <select
                          id={`task-workspace-${index}`}
                          value={task.workspace ?? ''}
                          onChange={(e) => {
                            const ws = workspaces.find(w => w.path === e.target.value)
                            updateTask(index, 'workspace', e.target.value)
                            // If no environment selected, pre-fill CWD with parent directory (project root)
                            if (ws && !task.selectedEnvId) {
                              // Workspace path is /root/projects/agents-manager/projects/{name}/agent-coder
                              // We want the parent: /root/projects/agents-manager/projects/{name}
                              const projectRoot = ws.path.split('/agent-coder')[0]
                              updateTask(index, 'cwd', projectRoot)
                            }
                          }}
                          className={cn(
                            'block w-full rounded-md border-gray-300 shadow-sm',
                            'focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm',
                            'px-3 py-2 border',
                            errors.tasks?.[index] && 'border-red-500'
                          )}
                          required
                        >
                          <option value="">Select agent workspace...</option>
                          {workspaces.map(ws => (
                            <option key={ws.id} value={ws.path}>
                              {ws.name}
                            </option>
                          ))}
                        </select>
                        {workspaces.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            No workspaces registered.{' '}
                            <Link to="/agents" className="underline">Create workspace</Link>
                          </p>
                        )}
                      </div>

                      {/* Environment - ONDE executa */}
                      <div>
                        <label
                          htmlFor={`task-environment-${index}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Environment
                          <span className="text-xs text-gray-400 ml-1">— defines where files will be created</span>
                        </label>
                        <select
                          id={`task-environment-${index}`}
                          value={task.selectedEnvId ?? ''}
                          onChange={(e) => {
                            const envId = e.target.value
                            updateTask(index, 'selectedEnvId', envId)

                            if (envId) {
                              const env = environments.find(e => e.id === envId)
                              if (env) {
                                // Update cwd with project_path from environment
                                updateTask(index, 'cwd', env.project_path)
                                // Set env_context for prompt injection
                                updateTask(index, 'env_context', `${env.name} (${env.type})\nProject path: ${env.project_path}`)
                                // If workspace not selected yet, use agent_workspace
                                if (!task.workspace) {
                                  updateTask(index, 'workspace', env.agent_workspace)
                                }
                              }
                            } else {
                              // Clear environment, reset to workspace project root
                              const ws = workspaces.find(w => w.path === task.workspace)
                              if (ws) {
                                const projectRoot = ws.path.split('/agent-coder')[0]
                                updateTask(index, 'cwd', projectRoot)
                              } else {
                                updateTask(index, 'cwd', task.workspace)
                              }
                              updateTask(index, 'env_context', '')
                            }
                          }}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        >
                          <option value="">Same as agent workspace (default)</option>
                          {environments.map(env => (
                            <option key={env.id} value={env.id}>
                              {env.project_name} — {env.name} ({env.type})
                            </option>
                          ))}
                        </select>
                        {task.selectedEnvId && (() => {
                          const env = environments.find(e => e.id === task.selectedEnvId)
                          if (!env) return null
                          return (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs space-y-1">
                              <div className="flex gap-2">
                                <span className="text-blue-500 font-medium w-28">Working dir:</span>
                                <code className="text-blue-700">{env.project_path}</code>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-blue-500 font-medium w-28">Agent config:</span>
                                <code className="text-blue-700 break-all">{env.agent_workspace}</code>
                              </div>
                            </div>
                          )
                        })()}
                        {environments.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            No environments registered.{' '}
                            <Link to="/projects" className="underline">Manage projects</Link>
                          </p>
                        )}
                      </div>

                      {/* Working directory - read-only, derived from environment or workspace */}
                      <div>
                        <label
                          htmlFor={`task-cwd-${index}`}
                          className="block text-sm font-medium text-gray-400 mb-1 text-xs"
                        >
                          Working directory (cwd)
                          <span className="ml-1 text-gray-300">— where files will be created</span>
                        </label>
                        <input
                          type="text"
                          id={`task-cwd-${index}`}
                          value={task.cwd}
                          readOnly
                          className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border bg-gray-50 text-gray-500 cursor-default sm:text-sm"
                          placeholder="Derived from environment or agent workspace"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Link
                to="/"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className={cn(
                  'rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                  'hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

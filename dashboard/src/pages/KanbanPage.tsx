import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Link2, LayoutGrid, CheckCircle, Zap, Play } from 'lucide-react';
import { PageHeader, Button, Select, EmptyState, ConfirmDialog, Switch } from '@/components';
import { useGetProjects, useUpdateProject } from '@/api/projects';
import { useApprovePlan } from '@/api/plans';
import { useToast } from '@/contexts/ToastContext';
import {
  useGetAllKanbanTasks,
  useCreateKanbanTaskAny,
  useUpdateKanbanTaskAny,
  useDeleteKanbanTaskAny,
  useUpdateKanbanPipelineAny,
  useAutoMoveKanbanAny,
  getProjectColor,
  COLUMNS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RESULT_STATUS_COLORS,
  PIPELINE_STATUS_CONFIG,
  type KanbanTask,
} from '@/api/kanban';

export default function KanbanPage() {
  const navigate = useNavigate();
  const { data: projects = [] } = useGetProjects();
  const [projectFilter, setProjectFilter] = useState<string>('');

  const { data: allTasks = [], isLoading } = useGetAllKanbanTasks();
  const createTask = useCreateKanbanTaskAny();
  const updateTask = useUpdateKanbanTaskAny();
  const deleteTask = useDeleteKanbanTaskAny();
  const updatePipeline = useUpdateKanbanPipelineAny();
  const approvePlan = useApprovePlan();
  const autoMove = useAutoMoveKanbanAny();
  const { showAutoMoveToast, showError, showSuccess } = useToast();

  // Auto-move mutations
  const updateProject = useUpdateProject();

  // Track recently auto-moved tasks for visual indicator
  const [recentlyMovedTasks, setRecentlyMovedTasks] = useState<Set<string>>(new Set());
  const recentlyMovedTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Filter tasks based on selected project
  const tasks = projectFilter
    ? allTasks.filter((task) => task.project_id === projectFilter)
    : allTasks;

  // Initialize auto-move state from project settings
  useEffect(() => {
    if (projectFilter) {
      const project = projects.find(p => p.id === projectFilter);
      setAutoMoveEnabled(project?.settings?.auto_move_enabled ?? false);
      setAutoMoveProjectId(projectFilter);
    } else if (projects.length === 1) {
      setAutoMoveEnabled(projects[0]?.settings?.auto_move_enabled ?? false);
      setAutoMoveProjectId(projects[0]?.id ?? '');
    } else {
      setAutoMoveEnabled(false);
      setAutoMoveProjectId('');
    }
  }, [projectFilter, projects]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 3 as 1 | 2 | 3 | 4 | 5,
    column: 'backlog' as KanbanTask['column'],
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>('');

  // Auto-move state
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [autoMoveProjectId, setAutoMoveProjectId] = useState<string>('');

  const handleOpenCreate = (column?: KanbanTask['column']) => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      priority: 3,
      column: column || 'backlog',
    });
    // Set the project ID for creating the task
    if (projectFilter) {
      setCreateProjectId(projectFilter);
    } else if (projects.length === 1) {
      setCreateProjectId(projects[0].id);
    } else {
      setCreateProjectId('');
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (task: KanbanTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      column: task.column,
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) return;

    if (editingTask) {
      updateTask.mutate({
        projectId: editingTask.project_id,
        id: editingTask.id,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        column: formData.column,
      });
    } else {
      // For creating tasks, use the createProjectId state
      if (!createProjectId) return;
      createTask.mutate({
        projectId: createProjectId,
        data: formData,
      });
    }
    setModalOpen(false);
  };

  const handleMoveTask = (task: KanbanTask, direction: 'left' | 'right') => {
    const currentIndex = COLUMNS.findIndex((col) => col.id === task.column);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < COLUMNS.length) {
      updateTask.mutate({
        projectId: task.project_id,
        id: task.id,
        column: COLUMNS[newIndex].id as KanbanTask['column'],
      });
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      const task = allTasks.find(t => t.id === deleteConfirm);
      if (task) {
        deleteTask.mutate({ projectId: task.project_id, taskId: deleteConfirm });
      }
      setDeleteConfirm(null);
    }
  };

  const handleToggleAutoMove = (enabled: boolean) => {
    setAutoMoveEnabled(enabled);
    if (autoMoveProjectId) {
      const project = projects.find(p => p.id === autoMoveProjectId);
      updateProject.mutate({
        id: autoMoveProjectId,
        settings: {
          auto_move_enabled: enabled,
          auto_approve_workflows: project?.settings?.auto_approve_workflows ?? false
        }
      });
    }
  };

  const handleRunAutoMove = () => {
    if (!autoMoveProjectId) return;

    autoMove.mutate(autoMoveProjectId, {
      onSuccess: (result) => {
        if (result.moved_tasks?.length > 0) {
          showSuccess(
            `Auto-moved ${result.moved_tasks.length} task${result.moved_tasks.length > 1 ? 's' : ''}`,
            'Tasks have been moved based on their status'
          );

          // Mark recently moved tasks for visual indicator
          const newMovedTasks = new Set(recentlyMovedTasks);
          result.moved_tasks.forEach((move) => {
            newMovedTasks.add(move.task.id);
            showAutoMoveToast(move.task.title, move.from_column, move.to_column);

            // Clear the timeout if it exists
            const existingTimeout = recentlyMovedTimeoutsRef.current.get(move.task.id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // Remove the visual indicator after 5 seconds
            const timeout = setTimeout(() => {
              setRecentlyMovedTasks((prev) => {
                const next = new Set(prev);
                next.delete(move.task.id);
                return next;
              });
            }, 5000);

            recentlyMovedTimeoutsRef.current.set(move.task.id, timeout);
          });

          setRecentlyMovedTasks(newMovedTasks);
        }
      },
      onError: (error: Error) => {
        showError('Auto-move failed', error.message);
      },
    });
  };

  // Auto-move polling
  useEffect(() => {
    if (!autoMoveEnabled || !autoMoveProjectId) return;

    const interval = setInterval(() => {
      autoMove.mutate(autoMoveProjectId, {
        onSuccess: (result) => {
          if (result.moved_tasks?.length > 0) {
            // Mark recently moved tasks for visual indicator
            const newMovedTasks = new Set(recentlyMovedTasks);
            result.moved_tasks.forEach((move) => {
              newMovedTasks.add(move.task.id);
              showAutoMoveToast(move.task.title, move.from_column, move.to_column);

              // Clear the timeout if it exists
              const existingTimeout = recentlyMovedTimeoutsRef.current.get(move.task.id);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }

              // Remove the visual indicator after 5 seconds
              const timeout = setTimeout(() => {
                setRecentlyMovedTasks((prev) => {
                  const next = new Set(prev);
                  next.delete(move.task.id);
                  return next;
                });
              }, 5000);

              recentlyMovedTimeoutsRef.current.set(move.task.id, timeout);
            });

            setRecentlyMovedTasks(newMovedTasks);
          }
        },
        onError: (error: Error) => {
          console.error('Auto-move polling error:', error);
          // Don't show error toast for polling errors to avoid spam
          // Just log it for debugging
        },
      });
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(interval);
  }, [autoMoveEnabled, autoMoveProjectId, autoMove, showAutoMoveToast]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      recentlyMovedTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      recentlyMovedTimeoutsRef.current.clear();
    };
  }, []);

  const getTasksByColumn = (columnId: string) => {
    return tasks
      .filter((task) => task.column === columnId)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const getTaskColumn = (taskId: string) =>
    allTasks.find(t => t.id === taskId)?.column ?? 'backlog';

  if (projects.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <PageHeader title="Kanban Board" description="Manage your project tasks" />
        <EmptyState
          icon={<LayoutGrid className="h-12 w-12" />}
          title="No projects found"
          description="Create a project first to use the kanban board"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <PageHeader
        title="Kanban Board"
        description={
          projectFilter
            ? `Tasks for ${projects.find((p) => p.id === projectFilter)?.name || 'selected project'}`
            : 'All Projects'
        }
        actions={
          <div className="flex items-center gap-3">
            {autoMoveProjectId && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md">
                <Zap className={`h-4 w-4 ${autoMoveEnabled ? 'text-yellow-500' : 'text-gray-400'}`} />
                <span className="text-sm text-gray-700">Auto-move</span>
                <Switch
                  checked={autoMoveEnabled}
                  onCheckedChange={handleToggleAutoMove}
                  disabled={updateProject.isPending}
                />
                {autoMoveEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRunAutoMove}
                    disabled={autoMove.isPending || !autoMoveEnabled}
                    title="Run auto-move now"
                    className="p-1 ml-1"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            {projects.length > 0 && (
              <Select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-48"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="primary" onClick={() => handleOpenCreate()}>
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-500">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-12 w-12" />}
          title="No tasks yet"
          description="Create your first task to get started"
          action={<Button variant="primary" onClick={() => handleOpenCreate()}>Add Task</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-4 h-full overflow-y-auto">
          {COLUMNS.map((column) => {
            const columnTasks = getTasksByColumn(column.id);
            return (
              <div key={column.id} className="flex flex-col min-h-0 bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{column.label}</h3>
                  <span className="text-xs font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {columnTasks.length}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenCreate(column.id as KanbanTask['column'])}
                  className="w-full m-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add task
                </Button>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverColumn(column.id);
                  }}
                  onDragLeave={(e) => {
                    // Só limpa se saiu da coluna de fato (não entrou em filho)
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverColumn(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedTaskId && column.id !== getTaskColumn(draggedTaskId)) {
                      const task = allTasks.find(t => t.id === draggedTaskId);
                      if (task) {
                        updateTask.mutate({
                          projectId: task.project_id,
                          id: draggedTaskId,
                          column: column.id as KanbanTask['column'],
                        });
                      }
                    }
                    setDraggedTaskId(null);
                    setDragOverColumn(null);
                  }}
                  className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors rounded-b-lg ${
                    dragOverColumn === column.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : ''
                  }`}
                >
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => handleOpenEdit(task)}
                      onMoveLeft={() => handleMoveTask(task, 'left')}
                      onMoveRight={() => handleMoveTask(task, 'right')}
                      onDelete={() => setDeleteConfirm(task.id)}
                      canMoveLeft={column.id !== 'backlog'}
                      canMoveRight={column.id !== 'done'}
                      onDragStart={(taskId) => {
                        setDraggedTaskId(taskId);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverColumn(null);
                      }}
                      isDragging={draggedTaskId === task.id}
                      recentlyMoved={recentlyMovedTasks.has(task.id)}
                      onRetryPipeline={(taskId) => {
                        const task = allTasks.find(t => t.id === taskId);
                        if (task) {
                          updatePipeline.mutate({
                            projectId: task.project_id,
                            taskId,
                            data: {
                              pipeline_status: 'idle',
                              workflow_id: null,
                              error_message: ''
                            }
                          });
                        }
                      }}
                      onApproveWorkflow={(workflowId) => {
                        approvePlan.mutate(workflowId);
                      }}
                      onViewWorkflow={(workflowId) => {
                        navigate(`/plans/${workflowId}`, {
                          state: { from: '/kanban', fromLabel: 'Kanban' }
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {editingTask ? 'Edit Task' : 'Create Task'}
            </h3>

            <div className="space-y-4">
              {!editingTask && !projectFilter && projects.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Project *
                  </label>
                  <Select
                    value={createProjectId}
                    onChange={(e) => setCreateProjectId(e.target.value)}
                  >
                    <option value="">Select project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="Task title"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Task description"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <Select
                    value={formData.priority.toString()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
                      })
                    }
                  >
                    <option value="1">1 - Critical</option>
                    <option value="2">2 - High</option>
                    <option value="3">3 - Medium</option>
                    <option value="4">4 - Low</option>
                    <option value="5">5 - Minimal</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Column
                  </label>
                  <Select
                    value={formData.column}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        column: e.target.value as KanbanTask['column'],
                      })
                    }
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!formData.title.trim() || (!editingTask && !createProjectId && !projectFilter && projects.length > 1)}
                loading={updateTask.isPending}
              >
                {editingTask ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete task?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        loading={deleteTask.isPending}
      />
    </div>
  );
}

interface TaskCardProps {
  task: KanbanTask;
  onEdit: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onRetryPipeline: (taskId: string) => void;
  onApproveWorkflow: (workflowId: string) => void;
  onViewWorkflow: (workflowId: string) => void;
  recentlyMoved?: boolean;
}

function TaskCard({
  task,
  onEdit,
  onMoveLeft,
  onMoveRight,
  onDelete,
  canMoveLeft,
  canMoveRight,
  onDragStart,
  onDragEnd,
  isDragging,
  onRetryPipeline,
  onApproveWorkflow,
  onViewWorkflow,
  recentlyMoved = false,
}: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={onDragEnd}
      className={`group bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-all cursor-grab active:cursor-grabbing relative ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${recentlyMoved ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}
    >
      {/* Auto-move badge */}
      {recentlyMoved && (
        <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 animate-pulse">
          <Zap className="h-3 w-3" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-900 flex-1">{task.title}</h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveLeft}
            disabled={!canMoveLeft}
            title="Move left"
            className="p-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveRight}
            disabled={!canMoveRight}
            title="Move right"
            className="p-1"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Edit" className="p-1">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete" className="p-1">
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>

        {task.project_name && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${getProjectColor(task.project_id)}`}
          >
            {task.project_name}
          </span>
        )}

        {task.result_status && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${RESULT_STATUS_COLORS[task.result_status]}`}
          >
            {task.result_status === 'success'
              ? '✓ Success'
              : task.result_status === 'partial'
                ? '◐ Partial'
                : '✗ Needs Rework'}
          </span>
        )}

        {task.result_notes && task.result_status && task.result_status !== 'success' && (
          <p className="text-xs text-gray-500 mt-2 italic line-clamp-2" title={task.result_notes}>
            💬 {task.result_notes}
          </p>
        )}

        {task.workflow_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewWorkflow(task.workflow_id!);
            }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Link2 className="h-3 w-3" />
            Workflow {task.workflow_name ? `(${task.workflow_name})` : ''}
          </button>
        )}
      </div>

      {/* Pipeline status */}
      {task.pipeline_status && task.pipeline_status !== 'idle' && (() => {
        const cfg = PIPELINE_STATUS_CONFIG[task.pipeline_status];
        if (!cfg || !cfg.label) return null;
        return (
          <p className={`text-xs font-medium mt-2 ${
            cfg.animated ? 'animate-pulse' : ''
          } ${cfg.className}`}>
            {cfg.label}
          </p>
        );
      })()}

      {/* Error message */}
      {task.pipeline_status === 'failed' && task.error_message && (
        <p className="text-xs text-red-500 mt-1 truncate" title={task.error_message}>
          {task.error_message}
        </p>
      )}

      {/* Retry button for failed pipelines */}
      {task.pipeline_status === 'failed' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetryPipeline(task.id);
          }}
          className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
        >
          ↺ Retry pipeline
        </button>
      )}

      {/* Approve button for awaiting_approval pipelines */}
      {task.pipeline_status === 'awaiting_approval' && task.workflow_id && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApproveWorkflow(task.workflow_id!);
            }}
            className="text-xs px-2 py-1 bg-green-700 text-white rounded hover:bg-green-800 transition-colors flex items-center gap-1"
          >
            <CheckCircle className="h-3 w-3" /> Approve & Run
          </button>
        </div>
      )}
    </div>
  );
}

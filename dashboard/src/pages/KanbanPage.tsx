import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Link2, LayoutGrid } from 'lucide-react';
import { PageHeader, Button, Select, EmptyState, ConfirmDialog, Card } from '@/components';
import { useGetProjects } from '@/api/projects';
import {
  useGetKanbanTasks,
  useCreateKanbanTask,
  useUpdateKanbanTask,
  useDeleteKanbanTask,
  COLUMNS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RESULT_STATUS_COLORS,
  type KanbanTask,
} from '@/api/kanban';

export default function KanbanPage() {
  const { data: projects = [] } = useGetProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length === 1 ? projects[0].id : ''
  );

  const { data: tasks = [], isLoading } = useGetKanbanTasks(selectedProjectId);
  const createTask = useCreateKanbanTask(selectedProjectId);
  const updateTask = useUpdateKanbanTask(selectedProjectId);
  const deleteTask = useDeleteKanbanTask(selectedProjectId);

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

  // Auto-select project if only one exists
  if (projects.length === 1 && !selectedProjectId) {
    setSelectedProjectId(projects[0].id);
  }

  const handleOpenCreate = (column?: KanbanTask['column']) => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      priority: 3,
      column: column || 'backlog',
    });
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
        id: editingTask.id,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        column: formData.column,
      });
    } else {
      createTask.mutate(formData);
    }
    setModalOpen(false);
  };

  const handleMoveTask = (task: KanbanTask, direction: 'left' | 'right') => {
    const currentIndex = COLUMNS.findIndex((col) => col.id === task.column);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < COLUMNS.length) {
      updateTask.mutate({
        id: task.id,
        column: COLUMNS[newIndex].id as KanbanTask['column'],
      });
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteTask.mutate(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const getTasksByColumn = (columnId: string) => {
    return tasks
      .filter((task) => task.column === columnId)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const getTaskColumn = (taskId: string) =>
    tasks.find(t => t.id === taskId)?.column ?? 'backlog';

  if (!selectedProjectId && projects.length > 1) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <PageHeader
          title="Kanban Board"
          description="Select a project to view its kanban board"
        />
        <Card className="p-6">
          <Select
            label="Project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Card>
      </div>
    );
  }

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
          projects.find((p) => p.id === selectedProjectId)?.name ||
          'Manage your project tasks'
        }
        actions={
          <div className="flex items-center gap-3">
            {projects.length > 1 && (
              <Select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-48"
              >
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
                      updateTask.mutate({ id: draggedTaskId, column: column.id as KanbanTask['column'] });
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
                disabled={!formData.title.trim()}
                loading={createTask.isPending || updateTask.isPending}
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
}: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={onDragEnd}
      className={`group bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
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

        {task.workflow_id && (
          <Link
            to={`/plans/${task.workflow_id}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Link2 className="h-3 w-3" />
            Workflow
          </Link>
        )}
      </div>
    </div>
  );
}

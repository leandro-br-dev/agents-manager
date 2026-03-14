import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface KanbanTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  column: 'backlog' | 'active' | 'in_progress' | 'done';
  priority: 1 | 2 | 3 | 4 | 5;
  order_index: number;
  workflow_id: string | null;
  result_status: 'success' | 'partial' | 'needs_rework' | null;
  result_notes: string;
  created_at: string;
  updated_at: string;
}

export const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'active', label: 'Active' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
] as const;

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Minimal'
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-orange-100 text-orange-700 border-orange-200',
  3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  4: 'bg-blue-100 text-blue-700 border-blue-200',
  5: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const RESULT_STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-700 border-green-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  needs_rework: 'bg-red-100 text-red-700 border-red-200',
};

export function useGetKanbanTasks(projectId: string) {
  return useQuery({
    queryKey: ['kanban', projectId],
    queryFn: () => apiClient.get<KanbanTask[]>(`/api/kanban/${projectId}`),
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

export function useCreateKanbanTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<KanbanTask>) =>
      apiClient.post<KanbanTask>(`/api/kanban/${projectId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', projectId] }),
  });
}

export function useUpdateKanbanTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<KanbanTask> & { id: string }) =>
      apiClient.put<KanbanTask>(`/api/kanban/${projectId}/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', projectId] }),
  });
}

export function useDeleteKanbanTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient.delete(`/api/kanban/${projectId}/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', projectId] }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export type PlanStatus = 'pending' | 'running' | 'success' | 'failed';

export interface Task {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  workspace: string;
  env_context?: string;
}

export interface Plan {
  id: string;
  name: string;
  status: PlanStatus;
  tasks: Task[];
  client_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
  result?: string;
}

export interface PlanLog {
  id: string;
  plan_id: string;
  task_id: string;
  message: string;
  created_at: string;
}

export interface CreatePlanRequest {
  name: string;
  tasks: Omit<Task, 'id'>[];
}

export const useGetPlans = () => {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => apiClient.get<Plan[]>('/api/plans'),
    refetchInterval: (query) => {
      const plans = query.state.data as Plan[] | undefined;
      // Poll every 2s if there are active plans, every 30s otherwise
      const hasActive = plans?.some(
        p => p.status === 'running' || p.status === 'pending'
      );
      return hasActive ? 2000 : 30000;
    },
    refetchIntervalInBackground: false, // pause when tab is not focused
  });
};

export const useGetPlan = (id: string) => {
  return useQuery({
    queryKey: ['plans', id],
    queryFn: () => apiClient.get<Plan>(`/api/plans/${id}`),
    enabled: !!id,
  });
};

export const useGetPlanLogs = (planId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['plans', planId, 'logs'],
    queryFn: () => apiClient.get<PlanLog[]>(`/api/plans/${planId}/logs`),
    enabled: enabled && !!planId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while the plan is running
      const plan = query.state.data as Plan | undefined;
      return plan?.status === 'running' ? 2000 : false;
    },
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlanRequest) =>
      apiClient.post<Plan>('/api/plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useDeletePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ success: boolean }>(`/api/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useExecutePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Plan>(`/api/plans/${id}/execute`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', data.id] });
    },
  });
};

export interface PlanMetrics {
  total: number;
  success_rate: number;
  avg_duration_seconds: number;
  last_7_days: {
    success: number;
    failed: number;
  };
  by_status: {
    pending: number;
    running: number;
    success: number;
    failed: number;
  };
}

export const useGetMetrics = () => {
  return useQuery({
    queryKey: ['plans', 'metrics'],
    queryFn: () => apiClient.get<PlanMetrics>('/api/plans/metrics'),
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: false,
  });
};

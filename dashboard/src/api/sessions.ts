import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export function useGetSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiFetch<any[]>('/api/sessions'),
    refetchInterval: 3000,
  })
}

export function useGetSession(id: string) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => apiFetch<any>(`/api/sessions/${id}`),
    enabled: !!id,
    refetchInterval: 2000,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name?: string
      project_id?: string
      workspace_path: string
      environment_id?: string
    }) => apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useSendMessage(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/api/sessions/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sessionId] }),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type Workspace = {
  id: string
  name: string
  path: string
  exists: boolean
  hasSettings: boolean
  hasClaude: boolean
  baseUrl: string | null
}

export type WorkspaceDetail = {
  id: string
  path: string
  claudeMd: string | null
  settings: any
  skills: Array<{ name: string; hasSkillMd: boolean }>
  agents: Array<{ name: string; file: string }>
}

export const workspaceKeys = {
  list: () => ['workspaces'] as const,
  detail: (id: string) => ['workspaces', id] as const,
}

export function useGetWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => apiClient.get<Workspace[]>('/api/workspaces'),
  })
}

export function useGetWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => apiClient.get<WorkspaceDetail>(`/api/workspaces/${id}`),
    enabled: !!id,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; project_path?: string; anthropic_base_url?: string; project_id?: string }) =>
      apiClient.post<{ id: string; path: string }>('/api/workspaces', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.list() }),
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ deleted: boolean }>(`/api/workspaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.list() }),
  })
}

export function useSaveClaudeMd(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiClient.put<{ saved: boolean }>(`/api/workspaces/${id}/claude-md`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.detail(id) }),
  })
}

export function useSaveSettings(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: any) =>
      apiClient.put<{ saved: boolean }>(`/api/workspaces/${id}/settings`, { settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.detail(id) }),
  })
}

export function useGetSkill(workspaceId: string, skillName: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'skills', skillName] as const,
    queryFn: () => apiClient.get<{ name: string; content: string }>(
      `/api/workspaces/${workspaceId}/skills/${skillName}`
    ),
    enabled: !!workspaceId && !!skillName,
  })
}

export function useInstallSkill(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      apiClient.post<{ name: string; installed: boolean }>(
        `/api/workspaces/${workspaceId}/skills`,
        { name, content }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}

export function useDeleteSkill(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (skillName: string) =>
      apiClient.delete<{ deleted: boolean }>(
        `/api/workspaces/${workspaceId}/skills/${skillName}`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}

export function useGetAgent(workspaceId: string, agentName: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'agents', agentName] as const,
    queryFn: () => apiClient.get<{ name: string; content: string }>(
      `/api/workspaces/${workspaceId}/agents/${agentName}`
    ),
    enabled: !!workspaceId && !!agentName,
  })
}

export function useSaveAgent(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      apiClient.put<{ saved: boolean }>(
        `/api/workspaces/${workspaceId}/agents/${name}`,
        { content }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}

export function useDeleteAgent(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (agentName: string) =>
      apiClient.delete<{ deleted: boolean }>(
        `/api/workspaces/${workspaceId}/agents/${agentName}`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}

export function useRenameAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient.put<{ old_path: string; new_path: string }>(
        `/api/workspaces/${id}/rename`,
        { name }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.list() }),
  })
}

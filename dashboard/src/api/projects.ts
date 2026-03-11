import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export type Environment = {
  id: string
  project_id: string
  name: string
  type: 'local-wsl' | 'local-windows' | 'ssh'
  project_path: string
  agent_workspace: string
  ssh_config?: string | null
  env_vars?: string | null
  created_at: string
}

export type Project = {
  id: string
  name: string
  description: string | null
  created_at: string
  environments: Environment[]
  agent_paths?: string[]
}

export function useGetProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch<{ id: string }>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useCreateEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Partial<Environment> }) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/environments`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, envId, data }: { projectId: string; envId: string; data: Partial<Environment> }) =>
      apiFetch(`/api/projects/${projectId}/environments/${envId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, envId }: { projectId: string; envId: string }) =>
      apiFetch(`/api/projects/${projectId}/environments/${envId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useGetAllEnvironments() {
  return useQuery({
    queryKey: ['projects', 'all-environments'],
    queryFn: async () => {
      const projects = await apiFetch<Project[]>('/api/projects')
      return projects.flatMap(p =>
        p.environments.map(e => ({ ...e, project_name: p.name }))
      ) as (Environment & { project_name: string })[]
    },
  })
}

export function useLinkAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, workspace_path }: { projectId: string; workspace_path: string }) =>
      apiFetch(`/api/projects/${projectId}/agents`, {
        method: 'POST',
        body: JSON.stringify({ workspace_path })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUnlinkAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, workspace_path }: { projectId: string; workspace_path: string }) =>
      apiFetch(`/api/projects/${projectId}/agents`, {
        method: 'DELETE',
        body: JSON.stringify({ workspace_path })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

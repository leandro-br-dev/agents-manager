import { useState } from 'react'
import { useGetProjects, useCreateProject, useDeleteProject, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment, useLinkAgent, useUnlinkAgent, type Environment } from '@/api/projects'
import { useGetWorkspaces } from '@/api/workspaces'
import { FolderOpen, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Link2, X } from 'lucide-react'
import { PageHeader, Button, Card, Input, Select, ConfirmDialog, EmptyState } from '@/components'

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useGetProjects()
  const { data: allWorkspaces } = useGetWorkspaces()
  const createProjectMutation = useCreateProject()
  const deleteProjectMutation = useDeleteProject()
  const createEnvironmentMutation = useCreateEnvironment()
  const updateEnvironmentMutation = useUpdateEnvironment()
  const deleteEnvironmentMutation = useDeleteEnvironment()
  const linkAgentMutation = useLinkAgent()
  const unlinkAgentMutation = useUnlinkAgent()

  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [showEnvForm, setShowEnvForm] = useState<Set<string>>(new Set())
  const [editingEnv, setEditingEnv] = useState<{ projectId: string; envId: string } | null>(null)
  const [linkingAgent, setLinkingAgent] = useState<string | null>(null)
  const [selectedLinkPath, setSelectedLinkPath] = useState('')
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deleteEnvConfirm, setDeleteEnvConfirm] = useState<{ projectId: string; envId: string; envName: string } | null>(null)

  // New environment form state
  const [newEnvData, setNewEnvData] = useState<Partial<Environment>>({
    name: '',
    type: 'local-wsl',
    project_path: '',
  })

  // Edit environment form state
  const [editEnvData, setEditEnvData] = useState<Partial<Environment>>({})

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <Card className="bg-red-50 border-red-200">
          <p className="text-red-700">Error loading projects: {(error as Error).message}</p>
        </Card>
      </div>
    )
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    try {
      await createProjectMutation.mutateAsync({
        name: newProjectName,
        description: newProjectDescription || undefined,
      })
      setNewProjectName('')
      setNewProjectDescription('')
      setShowNewProjectForm(false)
    } catch (error) {
      alert(`Failed to create project: ${(error as Error).message}`)
    }
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    setDeleteProjectConfirm({ id: projectId, name: projectName })
  }

  const confirmDeleteProject = async () => {
    if (!deleteProjectConfirm) return

    try {
      await deleteProjectMutation.mutateAsync(deleteProjectConfirm.id)
      setDeleteProjectConfirm(null)
    } catch (error) {
      alert(`Failed to delete project: ${(error as Error).message}`)
    }
  }

  const handleCreateEnvironment = async (projectId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!newEnvData.name?.trim() || !newEnvData.project_path?.trim()) {
      return
    }

    try {
      await createEnvironmentMutation.mutateAsync({
        projectId,
        data: newEnvData,
      })
      setNewEnvData({
        name: '',
        type: 'local-wsl',
        project_path: '',
      })
      setShowEnvForm(prev => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    } catch (error) {
      alert(`Failed to create environment: ${(error as Error).message}`)
    }
  }

  const handleUpdateEnvironment = async (projectId: string, envId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!editEnvData.name?.trim()) {
      return
    }

    try {
      await updateEnvironmentMutation.mutateAsync({
        projectId,
        envId,
        data: editEnvData,
      })
      setEditingEnv(null)
      setEditEnvData({})
    } catch (error) {
      alert(`Failed to update environment: ${(error as Error).message}`)
    }
  }

  const handleDeleteEnvironment = async (projectId: string, envId: string, envName: string) => {
    setDeleteEnvConfirm({ projectId, envId, envName })
  }

  const confirmDeleteEnvironment = async () => {
    if (!deleteEnvConfirm) return

    try {
      await deleteEnvironmentMutation.mutateAsync({ projectId: deleteEnvConfirm.projectId, envId: deleteEnvConfirm.envId })
      setDeleteEnvConfirm(null)
    } catch (error) {
      alert(`Failed to delete environment: ${(error as Error).message}`)
    }
  }

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const getEnvironmentBadgeColor = (type: string) => {
    switch (type) {
      case 'local-wsl':
        return 'bg-green-100 text-green-800'
      case 'local-windows':
        return 'bg-blue-100 text-blue-800'
      case 'ssh':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const startEditingEnv = (projectId: string, env: Environment) => {
    setEditingEnv({ projectId, envId: env.id })
    setEditEnvData({ ...env })
  }

  const handleLinkAgent = async () => {
    if (!linkingAgent || !selectedLinkPath) return

    try {
      await linkAgentMutation.mutateAsync({
        projectId: linkingAgent,
        workspace_path: selectedLinkPath
      })
      setLinkingAgent(null)
      setSelectedLinkPath('')
    } catch (error) {
      alert(`Failed to link agent: ${(error as Error).message}`)
    }
  }

  const handleUnlinkAgent = async (projectId: string, workspacePath: string) => {
    try {
      await unlinkAgentMutation.mutateAsync({
        projectId,
        workspace_path: workspacePath
      })
    } catch (error) {
      alert(`Failed to unlink agent: ${(error as Error).message}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <PageHeader
        title="Projects"
        description="Manage your projects and their execution environments"
        actions={
          <Button variant="primary" onClick={() => setShowNewProjectForm(!showNewProjectForm)}>
            <Plus size={18} /> New Project
          </Button>
        }
      />

      {/* New Project Form */}
      {showNewProjectForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
          <form onSubmit={handleCreateProject}>
            <div className="space-y-4">
              <Input
                label="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., CharHub"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  rows={3}
                  placeholder="Brief description of the project..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={createProjectMutation.isPending} loading={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowNewProjectForm(false)
                    setNewProjectName('')
                    setNewProjectDescription('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        {projects && projects.length > 0 ? (
          projects.map((project) => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {/* Project Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleProjectExpanded(project.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="text-blue-600" size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-0.5">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {project.environments.length} environment{project.environments.length !== 1 ? 's' : ''}
                    </span>
                    {expandedProjects.has(project.id) ? (
                      <ChevronUp size={20} className="text-gray-500" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-500" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project.id, project.name)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete project"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Environments and Agents */}
              {expandedProjects.has(project.id) && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  {/* Environments Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Environments</h4>
                      <button
                        onClick={() => {
                          setShowEnvForm(prev => new Set(prev).add(project.id))
                          setNewEnvData({
                            name: '',
                            type: 'local-wsl',
                            project_path: '',
                          })
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={16} />
                        Add Environment
                      </button>
                    </div>

                  {/* New Environment Form */}
                  {showEnvForm.has(project.id) && (
                    <Card className="mb-4">
                      <h5 className="text-sm font-semibold mb-3">Create New Environment</h5>
                      <form onSubmit={(e) => handleCreateEnvironment(project.id, e)}>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <Input
                            label="Name"
                            value={newEnvData.name || ''}
                            onChange={(e) => setNewEnvData({ ...newEnvData, name: e.target.value })}
                            placeholder="e.g., Development"
                            required
                          />
                          <Select
                            label="Type"
                            value={newEnvData.type || 'local-wsl'}
                            onChange={(e) => setNewEnvData({ ...newEnvData, type: e.target.value as Environment['type'] })}
                          >
                            <option value="local-wsl">Local WSL</option>
                            <option value="local-windows">Local Windows</option>
                            <option value="ssh">SSH</option>
                          </Select>
                          <Input
                            label="Project Path"
                            value={newEnvData.project_path || ''}
                            onChange={(e) => setNewEnvData({ ...newEnvData, project_path: e.target.value })}
                            placeholder="/root/projects/my-project"
                            hint="Where your project files are located"
                            required
                          />
                          {newEnvData.type === 'ssh' && (
                            <>
                              <Input
                                label="SSH Host"
                                value={newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config).host || '' : ''}
                                onChange={(e) => {
                                  const current = newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config) : {}
                                  setNewEnvData({
                                    ...newEnvData,
                                    ssh_config: JSON.stringify({ ...current, host: e.target.value })
                                  })
                                }}
                                placeholder="server.example.com"
                              />
                              <Input
                                label="SSH User"
                                value={newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config).user || '' : ''}
                                onChange={(e) => {
                                  const current = newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config) : {}
                                  setNewEnvData({
                                    ...newEnvData,
                                    ssh_config: JSON.stringify({ ...current, user: e.target.value })
                                  })
                                }}
                                placeholder="ubuntu"
                              />
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Agent workspace will be created automatically at <code className="bg-gray-100 px-1.5 py-0.5 rounded">projects/{project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/{newEnvData.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'env-name'}/agent-coder/</code>
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button type="submit" variant="primary" size="sm" disabled={createEnvironmentMutation.isPending} loading={createEnvironmentMutation.isPending}>
                            {createEnvironmentMutation.isPending ? 'Creating...' : 'Create'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setShowEnvForm(prev => {
                                const next = new Set(prev)
                                next.delete(project.id)
                                return next
                              })
                              setNewEnvData({
                                name: '',
                                type: 'local-wsl',
                                project_path: '',
                              })
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Card>
                  )}

                  {/* Environments List */}
                  {project.environments.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No environments yet. Create one to get started.</p>
                  ) : (
                    <div className="space-y-3">
                      {project.environments.map((env) => (
                        <div key={env.id} className="bg-white border border-gray-200 rounded-lg p-3">
                          {editingEnv?.projectId === project.id && editingEnv?.envId === env.id ? (
                            // Edit Form
                            <form onSubmit={(e) => handleUpdateEnvironment(project.id, env.id, e)}>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <Input
                                  label="Name"
                                  value={editEnvData.name || ''}
                                  onChange={(e) => setEditEnvData({ ...editEnvData, name: e.target.value })}
                                  required
                                />
                                <Select
                                  label="Type"
                                  value={editEnvData.type || 'local-wsl'}
                                  onChange={(e) => setEditEnvData({ ...editEnvData, type: e.target.value as Environment['type'] })}
                                >
                                  <option value="local-wsl">Local WSL</option>
                                  <option value="local-windows">Local Windows</option>
                                  <option value="ssh">SSH</option>
                                </Select>
                                <Input
                                  label="Project Path"
                                  value={editEnvData.project_path || ''}
                                  onChange={(e) => setEditEnvData({ ...editEnvData, project_path: e.target.value })}
                                  placeholder="/root/projects/my-project"
                                  hint="Where your project files are located"
                                  required
                                />
                              </div>
                              <p className="text-xs text-gray-400 mt-2">
                                Agent workspace is auto-generated and cannot be edited
                              </p>
                              <div className="flex gap-2">
                                <Button type="submit" variant="primary" size="sm" disabled={updateEnvironmentMutation.isPending} loading={updateEnvironmentMutation.isPending}>
                                  {updateEnvironmentMutation.isPending ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setEditingEnv(null)
                                    setEditEnvData({})
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          ) : (
                            // Display Mode
                            <>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className="font-medium text-gray-900">{env.name}</h5>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEnvironmentBadgeColor(env.type)}`}>
                                      {env.type}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-sm text-gray-600">
                                    <div>
                                      <span className="font-medium">Project path:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{env.project_path}</code>
                                    </div>
                                    <details className="mt-2">
                                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Agent workspace path</summary>
                                      <code className="text-xs text-gray-500 block mt-1 break-all">{env.agent_workspace}</code>
                                    </details>
                                    {env.type === 'ssh' && env.ssh_config && (
                                      <div>
                                        <span className="font-medium">SSH:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                                          {(() => {
                                            const config = JSON.parse(env.ssh_config)
                                            return `${config.user}@${config.host}`
                                          })()}
                                        </code>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => startEditingEnv(project.id, env)} title="Edit environment">
                                    <Edit2 size={14} />
                                  </Button>
                                  <Button variant="danger" size="sm" onClick={() => handleDeleteEnvironment(project.id, env.id, env.name)} title="Delete environment">
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>

                  {/* Agents Section */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agents</h4>
                      <Button variant="secondary" size="sm" onClick={() => setLinkingAgent(project.id)}>
                        <Link2 className="h-3.5 w-3.5" /> Link Agent
                      </Button>
                    </div>
                    {!project.agent_paths || project.agent_paths.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No agents linked yet. Agents are created automatically when you add an environment.</p>
                    ) : (
                      <div className="space-y-1">
                        {project.agent_paths.map(path => {
                          const name = path.split('/').slice(-1)[0] || path
                          return (
                            <div key={path} className="flex items-center justify-between py-1.5 px-3 bg-white border border-gray-200 rounded text-xs">
                              <span className="font-mono text-gray-600">{name}</span>
                              <button
                                onClick={() => handleUnlinkAgent(project.id, path)}
                                className="text-gray-400 hover:text-red-500 ml-2"
                                title="Unlink agent"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon={<FolderOpen size={48} className="text-gray-300" />}
            title="No projects yet"
            description="Create your first project to start managing your workspaces"
            action={
              <Button variant="primary" onClick={() => setShowNewProjectForm(true)}>
                <Plus size={18} /> Create Project
              </Button>
            }
          />
        )}
      </div>

      {/* Link Agent Modal */}
      {linkingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setLinkingAgent(null)} />
          <div className="relative bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-sm font-semibold mb-4">Link Agent to Project</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Select agent workspace</label>
              <Select
                value={selectedLinkPath}
                onChange={e => setSelectedLinkPath(e.target.value)}
              >
                <option value="">Choose agent...</option>
                {allWorkspaces
                  ?.filter(ws => !projects?.find(p => p.id === linkingAgent)?.agent_paths?.includes(ws.path))
                  .map(ws => (
                    <option key={ws.id} value={ws.path}>{ws.name}</option>
                  ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setLinkingAgent(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleLinkAgent}
                disabled={!selectedLinkPath || linkAgentMutation.isPending}
                loading={linkAgentMutation.isPending}
              >
                {linkAgentMutation.isPending ? 'Linking...' : 'Link'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deleteProjectConfirm !== null}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteProjectConfirm?.name}"? This will also delete all its environments.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDeleteProject}
        onCancel={() => setDeleteProjectConfirm(null)}
        loading={deleteProjectMutation.isPending}
      />

      <ConfirmDialog
        open={deleteEnvConfirm !== null}
        title="Delete Environment"
        description={`Are you sure you want to delete environment "${deleteEnvConfirm?.envName}"?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDeleteEnvironment}
        onCancel={() => setDeleteEnvConfirm(null)}
        loading={deleteEnvironmentMutation.isPending}
      />
    </div>
  )
}

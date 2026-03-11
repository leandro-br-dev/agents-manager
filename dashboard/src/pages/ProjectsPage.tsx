import { useState } from 'react'
import { useGetProjects, useCreateProject, useDeleteProject, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment, type Environment } from '@/api/projects'
import { FolderOpen, Plus, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react'

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useGetProjects()
  const createProjectMutation = useCreateProject()
  const deleteProjectMutation = useDeleteProject()
  const createEnvironmentMutation = useCreateEnvironment()
  const updateEnvironmentMutation = useUpdateEnvironment()
  const deleteEnvironmentMutation = useDeleteEnvironment()

  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [showEnvForm, setShowEnvForm] = useState<Set<string>>(new Set())
  const [editingEnv, setEditingEnv] = useState<{ projectId: string; envId: string } | null>(null)

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
      <div className="p-8">
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
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading projects: {(error as Error).message}
        </div>
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
    if (!confirm(`Are you sure you want to delete "${projectName}"? This will also delete all its environments.`)) {
      return
    }

    try {
      await deleteProjectMutation.mutateAsync(projectId)
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
    if (!confirm(`Are you sure you want to delete environment "${envName}"?`)) {
      return
    }

    try {
      await deleteEnvironmentMutation.mutateAsync({ projectId, envId })
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your projects and their execution environments</p>
        </div>
        <button
          onClick={() => setShowNewProjectForm(!showNewProjectForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      {/* New Project Form */}
      {showNewProjectForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
          <form onSubmit={handleCreateProject}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., CharHub"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Brief description of the project..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProjectForm(false)
                    setNewProjectName('')
                    setNewProjectDescription('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
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

              {/* Environments */}
              {expandedProjects.has(project.id) && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
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
                    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                      <h5 className="text-sm font-semibold mb-3">Create New Environment</h5>
                      <form onSubmit={(e) => handleCreateEnvironment(project.id, e)}>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                            <input
                              type="text"
                              value={newEnvData.name || ''}
                              onChange={(e) => setNewEnvData({ ...newEnvData, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="e.g., Development"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                            <select
                              value={newEnvData.type || 'local-wsl'}
                              onChange={(e) => setNewEnvData({ ...newEnvData, type: e.target.value as Environment['type'] })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              <option value="local-wsl">Local WSL</option>
                              <option value="local-windows">Local Windows</option>
                              <option value="ssh">SSH</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Project Path *</label>
                            <input
                              type="text"
                              value={newEnvData.project_path || ''}
                              onChange={(e) => setNewEnvData({ ...newEnvData, project_path: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="/root/projects/my-project  (where your project files are)"
                              required
                            />
                          </div>
                          {newEnvData.type === 'ssh' && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">SSH Host</label>
                                <input
                                  type="text"
                                  value={newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config).host || '' : ''}
                                  onChange={(e) => {
                                    const current = newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config) : {}
                                    setNewEnvData({
                                      ...newEnvData,
                                      ssh_config: JSON.stringify({ ...current, host: e.target.value })
                                    })
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  placeholder="server.example.com"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">SSH User</label>
                                <input
                                  type="text"
                                  value={newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config).user || '' : ''}
                                  onChange={(e) => {
                                    const current = newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config) : {}
                                    setNewEnvData({
                                      ...newEnvData,
                                      ssh_config: JSON.stringify({ ...current, user: e.target.value })
                                    })
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  placeholder="ubuntu"
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Agent workspace will be created automatically at <code className="bg-gray-100 px-1.5 py-0.5 rounded">projects/{project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/{newEnvData.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'env-name'}/agent-coder/</code>
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={createEnvironmentMutation.isPending}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                          >
                            {createEnvironmentMutation.isPending ? 'Creating...' : 'Create'}
                          </button>
                          <button
                            type="button"
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
                            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
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
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                  <input
                                    type="text"
                                    value={editEnvData.name || ''}
                                    onChange={(e) => setEditEnvData({ ...editEnvData, name: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                  <select
                                    value={editEnvData.type || 'local-wsl'}
                                    onChange={(e) => setEditEnvData({ ...editEnvData, type: e.target.value as Environment['type'] })}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  >
                                    <option value="local-wsl">Local WSL</option>
                                    <option value="local-windows">Local Windows</option>
                                    <option value="ssh">SSH</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Project Path</label>
                                  <input
                                    type="text"
                                    value={editEnvData.project_path || ''}
                                    onChange={(e) => setEditEnvData({ ...editEnvData, project_path: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="/root/projects/my-project  (where your project files are)"
                                    required
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mt-2">
                                Agent workspace is auto-generated and cannot be edited
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={updateEnvironmentMutation.isPending}
                                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                                >
                                  {updateEnvironmentMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEnv(null)
                                    setEditEnvData({})
                                  }}
                                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                  Cancel
                                </button>
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
                                  <button
                                    onClick={() => startEditingEnv(project.id, env)}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Edit environment"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEnvironment(project.id, env.id, env.name)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete environment"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
            <FolderOpen size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-4">Create your first project to start managing your workspaces</p>
            <button
              onClick={() => setShowNewProjectForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Project
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

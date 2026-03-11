import { useSearchParams } from 'react-router-dom'
import { useGetWorkspaces, useGetWorkspace, useCreateWorkspace, useDeleteWorkspace, useSaveClaudeMd, useSaveSettings, useGetSkill, useInstallSkill, useDeleteSkill, useGetAgent, useSaveAgent, useDeleteAgent, useRenameAgent, useGetWorkspaceEnvironments, useLinkEnvironment, useUnlinkEnvironment, useGetAgentTemplates, type Workspace } from '../api/workspaces'
import { useGetProjects, useGetAllEnvironments } from '../api/projects'
import { useState } from 'react'
import { Trash2, Plus, FolderOpen, FileText, Settings as SettingsIcon, Code, Users, Edit3, Pencil, Link2, X } from 'lucide-react'
import { PageHeader, Button, Card, Input, Select, ConfirmDialog, EmptyState } from '@/components'

export default function AgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const workspaceId = searchParams.get('workspace')

  if (workspaceId) {
    return <WorkspaceDetail workspaceId={workspaceId} onClose={() => setSearchParams({})} />
  }

  return <WorkspaceList onSelectWorkspace={(id) => setSearchParams({ workspace: id })} />
}

function WorkspaceList({ onSelectWorkspace }: { onSelectWorkspace: (id: string) => void }) {
  const { data: workspaces, isLoading, error } = useGetWorkspaces()
  const { data: projects } = useGetProjects()
  const { data: templates = [] } = useGetAgentTemplates()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [templateId, setTemplateId] = useState('generic')
  const createWorkspace = useCreateWorkspace()

  const canCreate = newName.trim().length > 0 && newProjectId.length > 0

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return

    createWorkspace.mutate(
      {
        name: newName,
        anthropic_base_url: newBaseUrl || undefined,
        project_id: newProjectId,
        template_id: templateId,
      },
      {
        onSuccess: () => {
          setNewName('')
          setNewBaseUrl('')
          setNewProjectId('')
          setTemplateId('generic')
          setShowNewForm(false)
        },
      }
    )
  }

  const slugify = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  }

  const getPathPreview = () => {
    if (!newProjectId || !newName) return null
    const proj = projects?.find(p => p.id === newProjectId)
    if (!proj) return null
    const projectSlug = slugify(proj.name)
    const agentSlug = slugify(newName)
    return `projects/${projectSlug}/agents/${agentSlug}/`
  }

  if (isLoading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">Error loading agents</div>

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <PageHeader
        title="Agents"
        description="Manage your AI agent workspaces and configurations"
        actions={
          <Button variant="primary" onClick={() => setShowNewForm(!showNewForm)}>
            <Plus size={18} /> New Agent
          </Button>
        }
      />

      {showNewForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Select
                label="Project *"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                required
              >
                <option value="" disabled>Select a project...</option>
                {projects?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <div>
                <Input
                  label="Agent name *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="frontend-dev"
                />
                {getPathPreview() && (
                  <p className="text-xs font-mono text-gray-400 mt-1">
                    {getPathPreview()}
                  </p>
                )}
              </div>
              <Select
                label="CLAUDE.md Template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="col-span-2"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label} — {t.description}</option>
                ))}
              </Select>
              {templateId && templates.find(t => t.id === templateId) && (
                <div className="col-span-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-500 font-medium">
                    {templates.find(t => t.id === templateId)?.description}
                  </p>
                </div>
              )}
              <Input
                label="Anthropic Base URL"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                placeholder="http://localhost:8083"
                className="col-span-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={!canCreate || createWorkspace.isPending}
              >
                {createWorkspace.isPending ? 'Creating...' : 'Create Agent'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowNewForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {workspaces && workspaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws: Workspace) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onClick={() => onSelectWorkspace(ws.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No agents yet"
          description="Create your first agent workspace to get started"
        />
      )}
    </div>
  )
}

function WorkspaceCard({
  workspace,
  onClick,
}: {
  workspace: any
  onClick: () => void
}) {
  const deleteWorkspace = useDeleteWorkspace()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteWorkspace.mutate(workspace.id, {
      onSuccess: () => {
        setShowConfirm(false)
        setIsDeleting(false)
      },
      onError: () => setIsDeleting(false)
    })
  }

  const getBaseUrlBadge = () => {
    if (!workspace.baseUrl) return { color: 'bg-red-100 text-red-800', label: 'No Base URL' }
    if (workspace.baseUrl.includes('localhost:8083')) {
      return { color: 'bg-green-100 text-green-800', label: 'localhost:8083' }
    }
    return { color: 'bg-yellow-100 text-yellow-800', label: workspace.baseUrl }
  }

  const badge = getBaseUrlBadge()

  // Extract project name from path
  // Path format: projects/{project-slug}/agents/{agent-name}/
  const getProjectSlug = () => {
    const match = workspace.path.match(/projects\/([^/]+)\//)
    return match ? match[1] : null
  }

  const projectSlug = getProjectSlug()

  return (
    <>
      <div onClick={onClick} className="hover:shadow-md transition-shadow cursor-pointer">
        <Card>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{workspace.name}</h3>
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(true)}
                title="Delete agent"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>

          {projectSlug && (
            <div className="mb-2">
              <span className="text-xs font-mono text-gray-400">
                Project: {projectSlug}
              </span>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
            <FolderOpen size={14} />
            {workspace.path}
          </p>

          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
            {workspace.hasClaude && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                ✓ CLAUDE.md
              </span>
            )}
            {workspace.hasSettings && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                ✓ Settings
              </span>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Delete Agent"
        description={`Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        loading={isDeleting}
      />
    </>
  )
}

function WorkspaceDetail({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { data: workspace, isLoading, error } = useGetWorkspace(workspaceId)
  const [activeTab, setActiveTab] = useState<'claude' | 'settings' | 'skills' | 'agents' | 'environments'>('claude')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const renameAgent = useRenameAgent()

  // Update newName when workspace loads
  if (workspace && newName !== workspace.name) {
    setNewName(workspace.name)
  }

  if (isLoading) return <div className="p-8">Loading agent...</div>
  if (error) return <div className="p-8 text-red-600">Error loading agent</div>
  if (!workspace) return null

  const handleRename = () => {
    if (newName && workspace && newName !== workspace.name) {
      renameAgent.mutate(
        { id: workspaceId, name: newName },
        {
          onSuccess: () => {
            setEditingName(false)
            // Redirect to new ID (the rename endpoint returns the new base64 ID)
            window.location.href = `/agents?workspace=${newName}`
          },
        }
      )
    } else {
      setEditingName(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <button onClick={onClose} className="text-blue-600 hover:text-blue-800 text-sm mb-4">
        ← Back to Agents
      </button>
      <div className="flex justify-between items-start mb-6">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                pattern="[a-zA-Z0-9_-]+"
                placeholder="agent-name"
                className="w-64"
              />
              <Button
                onClick={handleRename}
                disabled={renameAgent.isPending || !newName || !/^[a-zA-Z0-9_-]+$/.test(newName)}
                size="sm"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingName(false)
                  setNewName(workspace?.name || '')
                }}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{workspace.name}</h1>
              <Button
                variant="ghost"
                onClick={() => setEditingName(true)}
                title="Rename agent"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-1">{workspace.path}</p>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <TabButton active={activeTab === 'claude'} onClick={() => setActiveTab('claude')}>
            <FileText size={18} />
            CLAUDE.md
          </TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            <SettingsIcon size={18} />
            Settings
          </TabButton>
          <TabButton active={activeTab === 'skills'} onClick={() => setActiveTab('skills')}>
            <Code size={18} />
            Skills ({workspace.skills.length})
          </TabButton>
          <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')}>
            <Users size={18} />
            Agents ({workspace.agents.length})
          </TabButton>
          <TabButton active={activeTab === 'environments'} onClick={() => setActiveTab('environments')}>
            <Link2 size={18} />
            Environments
          </TabButton>
        </nav>
      </div>

      {activeTab === 'claude' && <ClaudeMdTab workspaceId={workspaceId} content={workspace.claudeMd} />}
      {activeTab === 'settings' && <SettingsTab workspaceId={workspaceId} settings={workspace.settings} />}
      {activeTab === 'skills' && <SkillsTab workspaceId={workspaceId} skills={workspace.skills} />}
      {activeTab === 'agents' && <AgentsTab workspaceId={workspaceId} agents={workspace.agents} />}
      {activeTab === 'environments' && <EnvironmentsTab workspaceId={workspaceId} />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function ClaudeMdTab({ workspaceId, content }: { workspaceId: string; content: string | null }) {
  const [value, setValue] = useState(content || '')
  const saveClaudeMd = useSaveClaudeMd(workspaceId)

  return (
    <div className="space-y-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full h-96 px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="# CLAUDE.md content..."
      />
      <button
        onClick={() => saveClaudeMd.mutate(value)}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Save
      </button>
    </div>
  )
}

function SettingsTab({ workspaceId, settings }: { workspaceId: string; settings: any }) {
  // env is an object like { KEY: 'value', KEY2: 'value2' }, convert to array of {key, value}
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(() =>
    Object.entries(settings?.env ?? {}).map(([key, value]) => ({ key, value: String(value) }))
  )
  const [permissions, setPermissions] = useState({
    allow: settings?.permissions?.allow || [],
    deny: settings?.permissions?.deny?.join('\n') || '',
  })
  const [additionalDirs, setAdditionalDirs] = useState<string[]>(
    settings?.permissions?.additionalDirectories || []
  )
  const saveSettings = useSaveSettings(workspaceId)

  const handleSave = () => {
    // Convert array of {key, value} back to object
    const envObject = Object.fromEntries(
      envVars.filter(e => e.key).map(e => [e.key, e.value])
    )
    const newSettings = {
      ...settings,
      env: envObject,
      permissions: {
        allow: permissions.allow,
        deny: permissions.deny.split('\n').filter(Boolean),
        additionalDirectories: additionalDirs,
      }
    }
    saveSettings.mutate(newSettings)
  }

  const permissionOptions = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Skill']

  return (
    <div className="space-y-6">
      {/* Env Vars */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Environment Variables</h3>
        <div className="space-y-2">
          {envVars.map((env, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={env.key}
                onChange={(e) => {
                  const newVars = [...envVars]
                  newVars[i].key = e.target.value
                  setEnvVars(newVars)
                }}
                placeholder="KEY"
                className="flex-1"
              />
              <Input
                value={env.value}
                onChange={(e) => {
                  const newVars = [...envVars]
                  newVars[i].value = e.target.value
                  setEnvVars(newVars)
                }}
                placeholder="value"
                className="flex-1"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}>
            <Plus size={16} /> Add Env Var
          </Button>
        </div>
      </Card>

      {/* Permissions */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Permissions</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Allow</label>
          <div className="flex flex-wrap gap-2">
            {permissionOptions.map((perm) => (
              <label key={perm} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permissions.allow.includes(perm)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPermissions({ ...permissions, allow: [...permissions.allow, perm] })
                    } else {
                      setPermissions({ ...permissions, allow: permissions.allow.filter((p: string) => p !== perm) })
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{perm}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Deny Rules</label>
          <textarea
            value={permissions.deny}
            onChange={(e) => setPermissions({ ...permissions, deny: e.target.value })}
            className="w-full h-24 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Deny rules (one per line)"
          />
        </div>
      </Card>

      {/* Additional Directories */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Directories</h3>
        <div className="space-y-2">
          {additionalDirs.map((dir, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={dir}
                onChange={(e) => {
                  const newDirs = [...additionalDirs]
                  newDirs[i] = e.target.value
                  setAdditionalDirs(newDirs)
                }}
                className="flex-1"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={() => setAdditionalDirs(additionalDirs.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setAdditionalDirs([...additionalDirs, ''])}>
            <Plus size={16} /> Add Directory
          </Button>
        </div>
      </Card>

      <Button variant="primary" onClick={handleSave}>Save Settings</Button>
    </div>
  )
}

function SkillsTab({ workspaceId, skills }: { workspaceId: string; skills: Array<{ name: string; hasSkillMd: boolean }> }) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [skillName, setSkillName] = useState('')
  const [skillContent, setSkillContent] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const installSkill = useInstallSkill(workspaceId)
  const deleteSkill = useDeleteSkill(workspaceId)
  const { data: skillData } = useGetSkill(workspaceId, editingSkill || '')

  const handleNewSkill = () => {
    setSkillName('')
    setSkillContent(`---
name: nova-skill
description: "Descreva quando usar esta skill"
---

# Nova Skill

## Quando usar

## Como usar
`)
    setShowNewForm(true)
  }

  const handleEdit = (skillName: string) => {
    setEditingSkill(skillName)
    setSkillName(skillName)
  }

  const handleSave = () => {
    installSkill.mutate(
      { name: skillName, content: skillContent },
      {
        onSuccess: () => {
          setShowNewForm(false)
          setEditingSkill(null)
          setSkillName('')
          setSkillContent('')
        },
      }
    )
  }

  const handleCancel = () => {
    setShowNewForm(false)
    setEditingSkill(null)
    setSkillName('')
    setSkillContent('')
  }

  const handleDelete = (skillName: string) => {
    setDeleteConfirm(skillName)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteSkill.mutate(deleteConfirm, {
        onSuccess: () => setDeleteConfirm(null)
      })
    }
  }

  // Update content when editing skill data loads
  if (editingSkill && skillData && skillContent === '') {
    setSkillContent(skillData.content)
  }

  const SKILL_TEMPLATE = `---
name: nova-skill
description: "Descreva quando usar esta skill"
---

# Nova Skill

## Quando usar

## Como usar
`

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Skills ({skills.length})</h3>
        <Button variant="primary" onClick={handleNewSkill}>
          <Plus size={16} /> New Skill
        </Button>
      </div>

      {(showNewForm || editingSkill) && (
        <Card>
          <div className="mb-3">
            <Input
              label="Name"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              placeholder="my-skill"
              className="font-mono"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={skillContent}
              onChange={(e) => setSkillContent(e.target.value)}
              className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={SKILL_TEMPLATE}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={installSkill.isPending || !skillName || !skillContent}
              variant="primary"
            >
              {installSkill.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="divide-y divide-gray-200">
          {skills.map((skill) => (
            <div key={skill.name} className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Code size={18} className="text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{skill.name}</div>
                  {skill.hasSkillMd && (
                    <span className="text-xs text-green-600">✓ SKILL.md</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(skill.name)} title="Edit skill">
                  <Edit3 size={16} />
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(skill.name)} title="Delete skill">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <EmptyState title="No skills installed" />
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Skill"
        description={`Are you sure you want to delete "${deleteConfirm}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

function AgentsTab({ workspaceId, agents }: { workspaceId: string; agents: Array<{ name: string; file: string }> }) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentContent, setAgentContent] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const saveAgent = useSaveAgent(workspaceId)
  const deleteAgent = useDeleteAgent(workspaceId)
  const { data: agentData } = useGetAgent(workspaceId, editingAgent || '')

  const handleNewAgent = () => {
    setAgentName('')
    setAgentContent(`---
name: new-agent
description: "Descreva quando invocar este agente"
model: sonnet
tools: Read, Write, Edit, Bash, Glob
color: blue
---

# New Agent

Descreva a especialidade e comportamento deste agente.
`)
    setShowNewForm(true)
  }

  const handleEdit = (agentName: string) => {
    setEditingAgent(agentName)
    setAgentName(agentName)
  }

  const handleSave = () => {
    saveAgent.mutate(
      { name: agentName, content: agentContent },
      {
        onSuccess: () => {
          setShowNewForm(false)
          setEditingAgent(null)
          setAgentName('')
          setAgentContent('')
        },
      }
    )
  }

  const handleCancel = () => {
    setShowNewForm(false)
    setEditingAgent(null)
    setAgentName('')
    setAgentContent('')
  }

  const handleDelete = (agentName: string) => {
    setDeleteConfirm(agentName)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteAgent.mutate(deleteConfirm, {
        onSuccess: () => setDeleteConfirm(null)
      })
    }
  }

  // Update content when editing agent data loads
  if (editingAgent && agentData && agentContent === '') {
    setAgentContent(agentData.content)
  }

  const AGENT_TEMPLATE = `---
name: new-agent
description: "Descreva quando invocar este agente"
model: sonnet
tools: Read, Write, Edit, Bash, Glob
color: blue
---

# New Agent

Descreva a especialidade e comportamento deste agente.
`

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Sub-Agents ({agents.length})</h3>
        <Button variant="primary" onClick={handleNewAgent}>
          <Plus size={16} /> New Agent
        </Button>
      </div>

      {(showNewForm || editingAgent) && (
        <Card>
          <div className="mb-3">
            <Input
              label="Name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="my-agent"
              className="font-mono"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={agentContent}
              onChange={(e) => setAgentContent(e.target.value)}
              className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={AGENT_TEMPLATE}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saveAgent.isPending || !agentName || !agentContent}
              variant="primary"
            >
              {saveAgent.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="divide-y divide-gray-200">
          {agents.map((agent) => (
            <div key={agent.name} className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.file}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(agent.name)} title="Edit agent">
                  <Edit3 size={16} />
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(agent.name)} title="Delete agent">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <EmptyState title="No sub-agents configured" />
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Agent"
        description={`Are you sure you want to delete "${deleteConfirm}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

function EnvironmentsTab({ workspaceId }: { workspaceId: string }) {
  const { data: linkedEnvs, isLoading } = useGetWorkspaceEnvironments(workspaceId)
  const { data: allEnvironments } = useGetAllEnvironments()
  const [linkingEnv, setLinkingEnv] = useState(false)
  const [selectedEnvToLink, setSelectedEnvToLink] = useState('')

  const linkEnv = useLinkEnvironment()
  const unlinkEnv = useUnlinkEnvironment()

  // Filter out already linked environments from the available options
  const availableEnvironments = allEnvironments?.filter(
    env => !linkedEnvs?.some(linked => linked.id === env.id)
  ) || []

  if (isLoading) return <div className="p-8">Loading environments...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Linked Environments</h3>
          <p className="text-sm text-gray-500 mt-1">
            Link environments to auto-populate additionalDirectories in settings.local.json
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setLinkingEnv(true)}
          disabled={availableEnvironments.length === 0}
        >
          <Link2 size={16} /> Link Environment
        </Button>
      </div>

      {!linkedEnvs || linkedEnvs.length === 0 ? (
        <Card>
          <EmptyState
            title="No environments linked"
            description="Link an environment to automatically add its project_path to the agent's additionalDirectories permissions."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-200">
            {linkedEnvs.map((env) => (
              <div key={env.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{env.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {env.type}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-gray-500">{env.project_path}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkEnv.mutate({ workspaceId, environment_id: env.id })}
                  title="Unlink environment"
                  disabled={unlinkEnv.isPending}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {linkingEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setLinkingEnv(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Link Environment</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select an environment to link to this agent. Its project_path will be automatically added to additionalDirectories.
            </p>

            {availableEnvironments.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">
                No available environments to link. All environments are already linked to this agent.
              </p>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Environment</label>
                  <Select
                    value={selectedEnvToLink}
                    onChange={(e) => setSelectedEnvToLink(e.target.value)}
                  >
                    <option value="" disabled>Select an environment...</option>
                    {availableEnvironments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name} ({env.project_name || 'Unknown Project'}) - {env.type}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setLinkingEnv(false)
                      setSelectedEnvToLink('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (selectedEnvToLink) {
                        linkEnv.mutate(
                          { workspaceId, environment_id: selectedEnvToLink },
                          {
                            onSuccess: () => {
                              setLinkingEnv(false)
                              setSelectedEnvToLink('')
                            }
                          }
                        )
                      }
                    }}
                    disabled={!selectedEnvToLink}
                    loading={linkEnv.isPending}
                  >
                    Link
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

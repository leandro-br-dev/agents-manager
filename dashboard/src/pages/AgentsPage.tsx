import { useSearchParams } from 'react-router-dom'
import { useGetWorkspaces, useGetWorkspace, useCreateWorkspace, useDeleteWorkspace, useSaveClaudeMd, useSaveSettings, useGetSkill, useInstallSkill, useDeleteSkill, useGetAgent, useSaveAgent, useDeleteAgent, useRenameAgent, type Workspace } from '../api/workspaces'
import { useState } from 'react'
import { Trash2, Plus, Check, X, FolderOpen, FileText, Settings as SettingsIcon, Code, Users, Edit3, Pencil } from 'lucide-react'

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
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('')
  const createWorkspace = useCreateWorkspace()

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createWorkspace.mutate(
      { name: newName, project_path: newPath || undefined, anthropic_base_url: newBaseUrl || undefined },
      {
        onSuccess: () => {
          setNewName('')
          setNewPath('')
          setNewBaseUrl('')
          setShowNewForm(false)
        },
      }
    )
  }

  if (isLoading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">Error loading agents</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Agents</h1>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          New Agent
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg shadow border border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Path</label>
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="/path/to/project"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic Base URL</label>
              <input
                type="text"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://localhost:8083"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces?.map((ws: Workspace) => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            onClick={() => onSelectWorkspace(ws.id)}
          />
        ))}
      </div>
    </div>
  )
}

function WorkspaceCard({
  workspace,
  onClick,
  onDelete,
}: {
  workspace: any
  onClick: () => void
  onDelete?: () => void
}) {
  const deleteWorkspace = useDeleteWorkspace()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = () => {
    deleteWorkspace.mutate(workspace.id, {
      onSuccess: onDelete,
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

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{workspace.name}</h3>
        {!showConfirm ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowConfirm(true)
            }}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              className="text-red-600 hover:text-red-800"
            >
              <Check size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowConfirm(false)
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>

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
    </div>
  )
}

function WorkspaceDetail({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { data: workspace, isLoading, error } = useGetWorkspace(workspaceId)
  const [activeTab, setActiveTab] = useState<'claude' | 'settings' | 'skills' | 'agents'>('claude')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(workspaceId)
  const renameAgent = useRenameAgent()

  if (isLoading) return <div className="p-8">Loading agent...</div>
  if (error) return <div className="p-8 text-red-600">Error loading agent</div>
  if (!workspace) return null

  const handleRename = () => {
    if (newName && newName !== workspaceId) {
      renameAgent.mutate(
        { id: workspaceId, name: newName },
        {
          onSuccess: () => {
            setEditingName(false)
            // Redirect to new name
            window.location.href = `/agents?workspace=${newName}`
          },
        }
      )
    } else {
      setEditingName(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={onClose} className="text-blue-600 hover:text-blue-800 mb-2">
            ← Back to Agents
          </button>
          {editingName ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border rounded px-2 py-1 text-sm font-mono"
                pattern="[a-zA-Z0-9_-]+"
                placeholder="agent-name"
              />
              <button
                onClick={handleRename}
                disabled={renameAgent.isPending || !newName || !/^[a-zA-Z0-9_-]+$/.test(newName)}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingName(false)
                  setNewName(workspaceId)
                }}
                className="text-gray-400 text-xs hover:text-gray-600 px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-semibold text-gray-900">{workspaceId}</h1>
              <button
                onClick={() => setEditingName(true)}
                className="text-gray-400 hover:text-gray-600"
                title="Rename agent"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-sm text-gray-500">{workspace.path}</p>
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
        </nav>
      </div>

      {activeTab === 'claude' && <ClaudeMdTab workspaceId={workspaceId} content={workspace.claudeMd} />}
      {activeTab === 'settings' && <SettingsTab workspaceId={workspaceId} settings={workspace.settings} />}
      {activeTab === 'skills' && <SkillsTab workspaceId={workspaceId} skills={workspace.skills} />}
      {activeTab === 'agents' && <AgentsTab workspaceId={workspaceId} agents={workspace.agents} />}
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
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Environment Variables</h3>
        <div className="space-y-2">
          {envVars.map((env, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={env.key}
                onChange={(e) => {
                  const newVars = [...envVars]
                  newVars[i].key = e.target.value
                  setEnvVars(newVars)
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="KEY"
              />
              <input
                type="text"
                value={env.value}
                onChange={(e) => {
                  const newVars = [...envVars]
                  newVars[i].value = e.target.value
                  setEnvVars(newVars)
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="value"
              />
              <button
                onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}
                className="px-3 py-2 text-red-600 hover:text-red-800"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Env Var
          </button>
        </div>
      </div>

      {/* Permissions */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
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
            className="w-full h-24 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg"
            placeholder="Deny rules (one per line)"
          />
        </div>
      </div>

      {/* Additional Directories */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Directories</h3>
        <div className="space-y-2">
          {additionalDirs.map((dir, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={dir}
                onChange={(e) => {
                  const newDirs = [...additionalDirs]
                  newDirs[i] = e.target.value
                  setAdditionalDirs(newDirs)
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={() => setAdditionalDirs(additionalDirs.filter((_, j) => j !== i))}
                className="px-3 py-2 text-red-600 hover:text-red-800"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setAdditionalDirs([...additionalDirs, ''])}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Directory
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  )
}

function SkillsTab({ workspaceId, skills }: { workspaceId: string; skills: Array<{ name: string; hasSkillMd: boolean }> }) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [skillName, setSkillName] = useState('')
  const [skillContent, setSkillContent] = useState('')

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
    if (confirm(`Delete skill ${skillName}?`)) {
      deleteSkill.mutate(skillName)
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
        <button
          onClick={handleNewSkill}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={18} />
          New Skill
        </button>
      </div>

      {(showNewForm || editingSkill) && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              placeholder="my-skill"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={skillContent}
              onChange={(e) => setSkillContent(e.target.value)}
              className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg"
              placeholder={SKILL_TEMPLATE}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={installSkill.isPending || !skillName || !skillContent}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {installSkill.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200">
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
                <button
                  onClick={() => handleEdit(skill.name)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit skill"
                >
                  <Edit3 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(skill.name)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete skill"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <div className="p-8 text-center text-gray-500">No skills installed</div>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentsTab({ workspaceId, agents }: { workspaceId: string; agents: Array<{ name: string; file: string }> }) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentContent, setAgentContent] = useState('')

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
    if (confirm(`Delete agent ${agentName}?`)) {
      deleteAgent.mutate(agentName)
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
        <button
          onClick={handleNewAgent}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={18} />
          New Agent
        </button>
      </div>

      {(showNewForm || editingAgent) && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              placeholder="my-agent"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={agentContent}
              onChange={(e) => setAgentContent(e.target.value)}
              className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg"
              placeholder={AGENT_TEMPLATE}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveAgent.isPending || !agentName || !agentContent}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saveAgent.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200">
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
                <button
                  onClick={() => handleEdit(agent.name)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit agent"
                >
                  <Edit3 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(agent.name)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete agent"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="p-8 text-center text-gray-500">No sub-agents configured</div>
          )}
        </div>
      </div>
    </div>
  )
}

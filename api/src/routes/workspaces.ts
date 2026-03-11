import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { agentWorkspacePath, envAgentPath, slugify } from '../utils/paths.js'
import { updateAgentSettings, rebuildAgentSettings } from '../utils/agentSettings.js'

const router = Router()

// Base path onde ficam os projetos de agentes
const AGENT_CLIENT_PATH = process.env.AGENT_CLIENT_PATH || '/root/projects/agents-manager/projects'

function getWorkspacePath(project: string): string {
  return path.join(AGENT_CLIENT_PATH, project, 'agent-coder')
}

interface WorkspaceInfo {
  id: string
  name: string
  path: string
  exists: boolean
  hasSettings: boolean
  hasClaude: boolean
  baseUrl: string | null
  type: 'agent' | 'env-agent' | 'legacy'
}

function readJsonSafe(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function listAllWorkspaces(): WorkspaceInfo[] {
  if (!fs.existsSync(AGENT_CLIENT_PATH)) {
    return []
  }

  const results: WorkspaceInfo[] = []

  // Read all project directories
  const projectDirs = fs.readdirSync(AGENT_CLIENT_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const projectDir of projectDirs) {
    const projectPath = path.join(AGENT_CLIENT_PATH, projectDir.name)
    const agentsDirPath = path.join(projectPath, 'agents')

    // New structure: {project}/agents/{agent-name}/
    if (fs.existsSync(agentsDirPath)) {
      const agentDirs = fs.readdirSync(agentsDirPath, { withFileTypes: true })
        .filter(d => d.isDirectory())

      for (const agentDir of agentDirs) {
        const fullPath = path.join(agentsDirPath, agentDir.name)
        const settingsPath = path.join(fullPath, '.claude', 'settings.local.json')
        const claudeMdPath = path.join(fullPath, 'CLAUDE.md')
        const settings = readJsonSafe(settingsPath)

        results.push({
          id: Buffer.from(fullPath).toString('base64url'),
          name: agentDir.name,
          path: fullPath,
          exists: true,
          hasSettings: fs.existsSync(settingsPath),
          hasClaude: fs.existsSync(claudeMdPath),
          baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
          type: 'agent'
        })
      }
    }

    // Environment agents: {project}/{env}/agent-coder/ (except 'agents' folder)
    const envDirs = fs.readdirSync(projectPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'agents')

    for (const envDir of envDirs) {
      const agentCoderPath = path.join(projectPath, envDir.name, 'agent-coder')
      if (fs.existsSync(agentCoderPath)) {
        const settingsPath = path.join(agentCoderPath, '.claude', 'settings.local.json')
        const claudeMdPath = path.join(agentCoderPath, 'CLAUDE.md')
        const settings = readJsonSafe(settingsPath)

        results.push({
          id: Buffer.from(agentCoderPath).toString('base64url'),
          name: `${projectDir.name}/${envDir.name}`,
          path: agentCoderPath,
          exists: true,
          hasSettings: fs.existsSync(settingsPath),
          hasClaude: fs.existsSync(claudeMdPath),
          baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
          type: 'env-agent'
        })
      }
    }

    // Legacy structure: {project}/agent-coder/ (for backward compatibility)
    const legacyAgentCoderPath = path.join(projectPath, 'agent-coder')
    if (fs.existsSync(legacyAgentCoderPath)) {
      const settingsPath = path.join(legacyAgentCoderPath, '.claude', 'settings.local.json')
      const claudeMdPath = path.join(legacyAgentCoderPath, 'CLAUDE.md')
      const settings = readJsonSafe(settingsPath)

      results.push({
        id: Buffer.from(legacyAgentCoderPath).toString('base64url'),
        name: projectDir.name,
        path: legacyAgentCoderPath,
        exists: true,
        hasSettings: fs.existsSync(settingsPath),
        hasClaude: fs.existsSync(claudeMdPath),
        baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
        type: 'legacy'
      })
    }
  }

  return results
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function getSkillParam(reqParams: any): string {
  const skill = reqParams.skill
  return Array.isArray(skill) ? skill[0] : skill
}

function getAgentParam(reqParams: any): string {
  const agent = reqParams.agent
  return Array.isArray(agent) ? agent[0] : agent
}

function getIdParam(reqParams: any): string {
  const id = reqParams.id
  return Array.isArray(id) ? id[0] : id
}


// GET /api/workspaces — listar todos os projetos
router.get('/', authenticateToken, (req, res) => {
  const all = listAllWorkspaces()
  const { project_id } = req.query
  if (project_id) {
    const linked = db.prepare(
      'SELECT workspace_path FROM project_agents WHERE project_id = ?'
    ).all(project_id as string) as any[]
    const linkedPaths = new Set(linked.map(l => l.workspace_path))
    const filtered = all.filter(ws => linkedPaths.has(ws.path))
    return res.json({ data: filtered, error: null })
  }
  return res.json({ data: all, error: null })
})

// GET /api/workspaces/:id — detalhes de um workspace
router.get('/:id', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  const settingsPath = path.join(coderPath, '.claude', 'settings.local.json')
  const claudeMdPath = path.join(coderPath, 'CLAUDE.md')
  const skillsPath = path.join(coderPath, '.claude', 'skills')
  const agentsPath = path.join(coderPath, '.claude', 'agents')

  const skills = fs.existsSync(skillsPath)
    ? fs.readdirSync(skillsPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({
          name: e.name,
          hasSkillMd: fs.existsSync(path.join(skillsPath, e.name, 'SKILL.md'))
        }))
    : []

  const agents = fs.existsSync(agentsPath)
    ? fs.readdirSync(agentsPath)
        .filter(f => f.endsWith('.md'))
        .map(f => ({ name: f.replace('.md', ''), file: f }))
    : []

  // Fetch linked environments
  const linkedEnvs = db.prepare(`
    SELECT e.id, e.name, e.type, e.project_path
    FROM agent_environments ae
    JOIN environments e ON e.id = ae.environment_id
    WHERE ae.workspace_path = ?
  `).all(coderPath) as any[]

  return res.json({
    data: {
      id: id,
      path: coderPath,
      exists: fs.existsSync(coderPath),
      claudeMd: readFileSafe(claudeMdPath),
      settings: readJsonSafe(settingsPath),
      skills,
      agents,
      environments: linkedEnvs,
    },
    error: null
  })
})

// POST /api/workspaces — criar novo workspace
router.post('/', authenticateToken, (req, res) => {
  const { name, project_path, anthropic_base_url = 'http://localhost:8083', project_id } = req.body

  if (!name) {
    return res.status(400).json({ data: null, error: 'name is required' })
  }

  if (!project_id) {
    return res.status(400).json({
      data: null,
      error: 'project_id is required to create an agent. Agents must belong to a project.'
    })
  }

  // Buscar o projeto para obter o slug
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any
  if (!project) {
    return res.status(404).json({ data: null, error: 'Project not found' })
  }

  // Gerar o path usando a nova estrutura
  const coderPath = agentWorkspacePath(AGENT_CLIENT_PATH, project.name, name)

  if (fs.existsSync(coderPath)) {
    return res.status(409).json({ data: null, error: 'Workspace already exists' })
  }

  const claudeDir = path.join(coderPath, '.claude')
  fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true })
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true })

  const projectTarget = project_path || `/root/projects/${project.name}`
  if (!fs.existsSync(projectTarget)) {
    fs.mkdirSync(projectTarget, { recursive: true })
  }

  const settings = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    env: {
      ANTHROPIC_BASE_URL: anthropic_base_url,
      API_TIMEOUT_MS: '3000000',
      CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: '1'
    },
    permissions: {
      allow: ['Read', 'Edit', 'Write', 'Bash', 'Glob'],
      deny: ['Bash(git push --force)', 'Bash(sudo:*)'],
      additionalDirectories: [projectTarget]
    }
  }
  fs.writeFileSync(
    path.join(claudeDir, 'settings.local.json'),
    JSON.stringify(settings, null, 2)
  )

  const claudeMd = `# Coder Agent — ${name}\n\nYou are implementing features for the ${project.name} project.\nThe project lives at \`${projectTarget}\`. All file operations target that directory.\n\n## Finishing checklist\n1. All tests pass\n2. Code runs without errors\n3. Changes committed\n`
  fs.writeFileSync(path.join(coderPath, 'CLAUDE.md'), claudeMd)

  // Criar vínculo com o projeto
  db.prepare(
    'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
  ).run(project_id, coderPath)

  return res.status(201).json({
    data: {
      id: Buffer.from(coderPath).toString('base64url'),
      path: coderPath,
      name: name,
      project_id: project_id
    },
    error: null
  })
})

// PUT /api/workspaces/:id/claude-md — salvar CLAUDE.md
router.put('/:id/claude-md', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const { content } = req.body
  if (typeof content !== 'string') {
    return res.status(400).json({ data: null, error: 'content must be a string' })
  }
  fs.writeFileSync(path.join(coderPath, 'CLAUDE.md'), content)
  return res.json({ data: { saved: true }, error: null })
})

// PUT /api/workspaces/:id/settings — salvar settings.local.json
router.put('/:id/settings', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const { settings } = req.body
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ data: null, error: 'settings must be an object' })
  }
  const claudeDir = path.join(coderPath, '.claude')
  if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true })
  fs.writeFileSync(
    path.join(claudeDir, 'settings.local.json'),
    JSON.stringify(settings, null, 2)
  )
  return res.json({ data: { saved: true }, error: null })
})

// DELETE /api/workspaces/:id — remover workspace
router.delete('/:id', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const projectPath = path.dirname(workspace.path) // get the project root path from coderPath

  // Always delete the entire project directory
  fs.rmSync(projectPath, { recursive: true, force: true })
  return res.json({ data: { deleted: true }, error: null })
})

// PUT /api/workspaces/:id/rename — renomear workspace (agent)
router.put('/:id/rename', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const { name } = req.body

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ data: null, error: 'name is required and must be a string' })
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({
      data: null,
      error: 'name must be alphanumeric (hyphens and underscores allowed)'
    })
  }

  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const oldProjectPath = path.dirname(workspace.path) // The actual project root
  const newProjectPath = path.join(AGENT_CLIENT_PATH, name)

  if (fs.existsSync(newProjectPath)) {
    return res.status(409).json({ data: null, error: 'An agent with this name already exists' })
  }

  try {
    fs.renameSync(oldProjectPath, newProjectPath)
    const oldCoderPath = workspace.path
    const newCoderPath = getWorkspacePath(name)
    return res.json({ data: { old_path: oldCoderPath, new_path: newCoderPath }, error: null })
  } catch (error) {
    return res.status(500).json({
      data: null,
      error: `Failed to rename agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})

// GET /api/workspaces/:id/skills/:skill — ler SKILL.md
router.get('/:id/skills/:skill', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const skillPath = path.join(
    workspace.path, '.claude', 'skills',
    getSkillParam(req.params), 'SKILL.md'
  )
  const content = readFileSafe(skillPath)
  if (content === null) return res.status(404).json({ data: null, error: 'Skill not found' })
  return res.json({ data: { name: getSkillParam(req.params), content }, error: null })
})

// POST /api/workspaces/:id/skills — instalar skill via URL ou conteúdo
router.post('/:id/skills', authenticateToken, (req, res) => {
  const { name, content } = req.body
  if (!name) return res.status(400).json({ data: null, error: 'name is required' })
  if (!content) return res.status(400).json({ data: null, error: 'content is required' })

  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path
  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const skillDir = path.join(coderPath, '.claude', 'skills', name)
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content)
  return res.status(201).json({ data: { name, installed: true }, error: null })
})

// DELETE /api/workspaces/:id/skills/:skill
router.delete('/:id/skills/:skill', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const skillDir = path.join(
    workspace.path, '.claude', 'skills', getSkillParam(req.params)
  )
  if (!fs.existsSync(skillDir)) {
    return res.status(404).json({ data: null, error: 'Skill not found' })
  }
  fs.rmSync(skillDir, { recursive: true, force: true })
  return res.json({ data: { deleted: true }, error: null })
})

// GET /api/workspaces/:id/agents/:agent — ler agent .md
router.get('/:id/agents/:agent', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Agent not found' })
  }

  const agentPath = path.join(
    workspace.path, '.claude', 'agents',
    `${getAgentParam(req.params)}.md`
  )
  const content = readFileSafe(agentPath)
  if (content === null) return res.status(404).json({ data: null, error: 'Agent not found' })
  return res.json({ data: { name: getAgentParam(req.params), content }, error: null })
})

// PUT /api/workspaces/:id/agents/:agent — criar ou editar agent .md
router.put('/:id/agents/:agent', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path
  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const { content } = req.body
  if (typeof content !== 'string') {
    return res.status(400).json({ data: null, error: 'content must be a string' })
  }
  const agentsDir = path.join(coderPath, '.claude', 'agents')
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true })
  fs.writeFileSync(path.join(agentsDir, `${getAgentParam(req.params)}.md`), content)
  return res.json({ data: { saved: true }, error: null })
})

// DELETE /api/workspaces/:id/agents/:agent
router.delete('/:id/agents/:agent', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Agent not found' })
  }

  const agentPath = path.join(
    workspace.path, '.claude', 'agents',
    `${getAgentParam(req.params)}.md`
  )
  if (!fs.existsSync(agentPath)) {
    return res.status(404).json({ data: null, error: 'Agent not found' })
  }
  fs.unlinkSync(agentPath)
  return res.json({ data: { deleted: true }, error: null })
})

// GET /api/workspaces/:id/environments — listar ambientes vinculados
router.get('/:id/environments', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const rows = db.prepare(`
    SELECT e.*, p.name as project_name
    FROM agent_environments ae
    JOIN environments e ON e.id = ae.environment_id
    JOIN projects p ON p.id = e.project_id
    WHERE ae.workspace_path = ?
  `).all(ws.path)

  return res.json({ data: rows, error: null })
})

// POST /api/workspaces/:id/environments — vincular ambiente
router.post('/:id/environments', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const { environment_id } = req.body
  if (!environment_id) return res.status(400).json({ data: null, error: 'environment_id required' })

  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(environment_id) as any
  if (!env) return res.status(404).json({ data: null, error: 'Environment not found' })

  db.prepare(
    'INSERT OR IGNORE INTO agent_environments (workspace_path, environment_id) VALUES (?, ?)'
  ).run(ws.path, environment_id)

  // Atualizar additionalDirectories no settings.local.json
  if (env.project_path) {
    updateAgentSettings(ws.path, [env.project_path])
  }

  return res.status(201).json({ data: { linked: true }, error: null })
})

// DELETE /api/workspaces/:id/environments — desvincular ambiente
router.delete('/:id/environments', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const { environment_id } = req.body
  db.prepare(
    'DELETE FROM agent_environments WHERE workspace_path = ? AND environment_id = ?'
  ).run(ws.path, environment_id)

  // Reconstruir additionalDirectories sem o ambiente removido
  const remaining = db.prepare(`
    SELECT e.project_path FROM agent_environments ae
    JOIN environments e ON e.id = ae.environment_id
    WHERE ae.workspace_path = ? AND e.project_path IS NOT NULL
  `).all(ws.path) as any[]

  rebuildAgentSettings(ws.path, remaining.map(r => r.project_path))

  return res.json({ data: { unlinked: true }, error: null })
})

export default router

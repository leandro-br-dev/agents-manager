import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'

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
  const entries = fs.readdirSync(AGENT_CLIENT_PATH, { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const coderPath = getWorkspacePath(e.name)
      const settingsPath = path.join(coderPath, '.claude', 'settings.local.json')
      const claudeMdPath = path.join(coderPath, 'CLAUDE.md')
      const settings = readJsonSafe(settingsPath)
      return {
        id: e.name,
        name: e.name,
        path: coderPath,
        exists: fs.existsSync(coderPath),
        hasSettings: fs.existsSync(settingsPath),
        hasClaude: fs.existsSync(claudeMdPath),
        baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
      }
    })
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

  return res.json({
    data: {
      id: id,
      path: coderPath,
      exists: fs.existsSync(coderPath),
      claudeMd: readFileSafe(claudeMdPath),
      settings: readJsonSafe(settingsPath),
      skills,
      agents,
    },
    error: null
  })
})

// POST /api/workspaces — criar novo workspace
router.post('/', authenticateToken, (req, res) => {
  const { name, project_path, anthropic_base_url = 'http://localhost:8083', project_id } = req.body
  if (!name) return res.status(400).json({ data: null, error: 'name is required' })

  const coderPath = getWorkspacePath(name)
  if (fs.existsSync(coderPath)) {
    return res.status(409).json({ data: null, error: 'Workspace already exists' })
  }

  const claudeDir = path.join(coderPath, '.claude')
  fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true })
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true })

  const projectTarget = project_path || `/root/projects/${name}`
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

  const claudeMd = `# Coder Agent — ${name}\n\nYou are implementing features for the ${name} project.\nThe project lives at \`${projectTarget}\`. All file operations target that directory.\n\n## Finishing checklist\n1. All tests pass\n2. Code runs without errors\n3. Changes committed\n`
  fs.writeFileSync(path.join(coderPath, 'CLAUDE.md'), claudeMd)

  // Se project_id fornecido, criar vínculo
  if (project_id) {
    db.prepare(
      'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
    ).run(project_id, coderPath)
  }

  return res.status(201).json({ data: { id: name, path: coderPath }, error: null })
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

export default router

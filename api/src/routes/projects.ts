import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'
import { envAgentPath } from '../utils/paths.js'

const router = Router()

// GET /api/projects
router.get('/', authenticateToken, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  const withEnvs = projects.map((p: any) => {
    const environments = db.prepare('SELECT * FROM environments WHERE project_id = ? ORDER BY created_at ASC').all(p.id)
    const agents = db.prepare('SELECT workspace_path FROM project_agents WHERE project_id = ?').all(p.id) as any[]
    return {
      ...p,
      environments,
      agent_paths: agents.map(a => a.workspace_path)
    }
  })
  return res.json({ data: withEnvs, error: null })
})

// POST /api/projects
router.post('/', authenticateToken, (req, res) => {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ data: null, error: 'name is required' })
  const id = uuid()
  db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)').run(id, name, description ?? null)
  return res.status(201).json({ data: { id, name, description }, error: null })
})

// GET /api/projects/:id
router.get('/:id', authenticateToken, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ data: null, error: 'Not found' })
  project.environments = db.prepare('SELECT * FROM environments WHERE project_id = ? ORDER BY created_at ASC').all(project.id)
  const agents = db.prepare('SELECT workspace_path FROM project_agents WHERE project_id = ?').all(project.id) as any[]
  project.agent_paths = agents.map(a => a.workspace_path)
  return res.json({ data: project, error: null })
})

// DELETE /api/projects/:id
router.delete('/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  return res.json({ data: { deleted: true }, error: null })
})

// POST /api/projects/:id/environments
router.post('/:id/environments', authenticateToken, (req, res) => {
  const { name, type, project_path, ssh_config, env_vars } = req.body
  if (!name || !project_path) {
    return res.status(400).json({ data: null, error: 'name and project_path are required' })
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

  // Use the new utility function for environment agent paths
  const AGENT_CLIENT_PATH = process.env.AGENT_CLIENT_PATH || '/root/projects/agents-manager/projects'
  const agent_workspace = envAgentPath(AGENT_CLIENT_PATH, project.name, name)

  // Create workspace directory structure
  const claudeDir = path.join(agent_workspace, '.claude')
  fs.mkdirSync(claudeDir, { recursive: true })

  // Basic CLAUDE.md if it doesn't exist
  const claudeMdPath = path.join(agent_workspace, 'CLAUDE.md')
  if (!fs.existsSync(claudeMdPath)) {
    fs.writeFileSync(claudeMdPath, `# ${project.name} — ${name}\n\nAgent workspace for the ${name} environment of ${project.name}.\n\n## Context\n- Environment: ${name}\n- Type: ${type ?? 'local-wsl'}\n- Project path: ${project_path}\n`)
  }

  // Basic settings.local.json if it doesn't exist
  const settingsPath = path.join(claudeDir, 'settings.local.json')
  if (!fs.existsSync(settingsPath)) {
    const settings = {
      env: { ANTHROPIC_BASE_URL: 'http://localhost:8083', API_TIMEOUT_MS: '3000000' },
      permissions: {
        allow: ['Read', 'Edit', 'Write', 'Bash', 'Glob'],
        deny: [],
        additionalDirectories: [project_path]
      }
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO environments (id, project_id, name, type, project_path, agent_workspace, ssh_config, env_vars)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, name,
    type ?? 'local-wsl',
    project_path,
    agent_workspace,
    ssh_config ? JSON.stringify(ssh_config) : null,
    env_vars ? JSON.stringify(env_vars) : null
  )

  // Vincular automaticamente o workspace recém-criado ao projeto
  db.prepare(
    'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
  ).run(req.params.id, agent_workspace)

  return res.status(201).json({ data: { id, name, type, project_path, agent_workspace }, error: null })
})

// PUT /api/projects/:projectId/environments/:envId
router.put('/:projectId/environments/:envId', authenticateToken, (req, res) => {
  const { name, type, project_path, ssh_config, env_vars } = req.body
  // Note: agent_workspace is auto-generated and cannot be updated
  const currentEnv = db.prepare('SELECT agent_workspace FROM environments WHERE id=? AND project_id=?').get(req.params.envId, req.params.projectId) as any
  if (!currentEnv) {
    return res.status(404).json({ data: null, error: 'Environment not found' })
  }

  db.prepare(`
    UPDATE environments SET name=?, type=?, project_path=?, ssh_config=?, env_vars=?
    WHERE id=? AND project_id=?
  `).run(
    name, type, project_path,
    ssh_config ? JSON.stringify(ssh_config) : null,
    env_vars ? JSON.stringify(env_vars) : null,
    req.params.envId, req.params.projectId
  )
  return res.json({ data: { updated: true }, error: null })
})

// DELETE /api/projects/:projectId/environments/:envId
router.delete('/:projectId/environments/:envId', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM environments WHERE id=? AND project_id=?').run(req.params.envId, req.params.projectId)
  return res.json({ data: { deleted: true }, error: null })
})

// POST /api/projects/:id/agents — vincular agente ao projeto
router.post('/:id/agents', authenticateToken, (req, res) => {
  const { workspace_path } = req.body
  if (!workspace_path) return res.status(400).json({ data: null, error: 'workspace_path required' })
  try {
    db.prepare(
      'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
    ).run(req.params.id, workspace_path)
    return res.status(201).json({ data: { linked: true }, error: null })
  } catch (e: any) {
    return res.status(400).json({ data: null, error: e.message })
  }
})

// DELETE /api/projects/:id/agents — desvincular agente
router.delete('/:id/agents', authenticateToken, (req, res) => {
  const { workspace_path } = req.body
  if (!workspace_path) return res.status(400).json({ data: null, error: 'workspace_path required' })
  db.prepare(
    'DELETE FROM project_agents WHERE project_id = ? AND workspace_path = ?'
  ).run(req.params.id, workspace_path)
  return res.json({ data: { unlinked: true }, error: null })
})

export default router

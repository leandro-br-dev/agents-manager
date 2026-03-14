import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import { randomUUID } from 'crypto'

const router = Router()

// GET /api/kanban/:projectId — listar todas as tasks do projeto
router.get('/:projectId', authenticateToken, (req: Request, res: Response) => {
  try {
    const tasks = db.prepare(`
      SELECT kt.*, p.status as workflow_status, p.name as workflow_name
      FROM kanban_tasks kt
      LEFT JOIN plans p ON p.id = kt.workflow_id
      WHERE kt.project_id = ?
      ORDER BY kt.column, kt.priority ASC, kt.order_index ASC
    `).all(req.params.projectId)
    res.json({ data: tasks, error: null })
  } catch (err: any) {
    console.error('Error fetching kanban tasks:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/kanban/:projectId — criar task
router.post('/:projectId', authenticateToken, (req: Request, res: Response) => {
  try {
    const { title, description = '', column = 'backlog', priority = 3 } = req.body
    if (!title) {
      return res.status(400).json({ data: null, error: 'title is required' })
    }

    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    const id = randomUUID()
    db.prepare(
      'INSERT INTO kanban_tasks (id, project_id, title, description, column, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.params.projectId, title, description, column, priority)
    const task = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(id)
    res.status(201).json({ data: task, error: null })
  } catch (err: any) {
    console.error('Error creating kanban task:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// PUT /api/kanban/:projectId/:taskId — atualizar task
router.put('/:projectId/:taskId', authenticateToken, (req: Request, res: Response) => {
  try {
    const { title, description, column, priority, order_index, workflow_id, result_status, result_notes } = req.body
    const task = db.prepare('SELECT * FROM kanban_tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.projectId) as any
    if (!task) {
      return res.status(404).json({ data: null, error: 'Task not found' })
    }

    db.prepare(`
      UPDATE kanban_tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        column = COALESCE(?, column),
        priority = COALESCE(?, priority),
        order_index = COALESCE(?, order_index),
        workflow_id = COALESCE(?, workflow_id),
        result_status = COALESCE(?, result_status),
        result_notes = COALESCE(?, result_notes),
        updated_at = datetime('now')
      WHERE id = ? AND project_id = ?
    `).run(title, description, column, priority, order_index, workflow_id, result_status, result_notes, req.params.taskId, req.params.projectId)

    const updated = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(req.params.taskId)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    console.error('Error updating kanban task:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// DELETE /api/kanban/:projectId/:taskId
router.delete('/:projectId/:taskId', authenticateToken, (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM kanban_tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.projectId)
    if (result.changes === 0) {
      return res.status(404).json({ data: null, error: 'Task not found' })
    }
    res.json({ data: { success: true }, error: null })
  } catch (err: any) {
    console.error('Error deleting kanban task:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/kanban/:projectId/pending-pipeline — retorna tasks ativas sem workflow
router.get('/:projectId/pending-pipeline', authenticateToken, (req: Request, res: Response) => {
  try {
    const tasks = db.prepare(`
      SELECT kt.*, p.settings as project_settings
      FROM kanban_tasks kt
      JOIN projects p ON p.id = kt.project_id
      WHERE kt.project_id = ?
        AND kt.column = 'active'
        AND (kt.workflow_id IS NULL OR kt.workflow_id = '')
        AND kt.pipeline_status = 'idle'
      ORDER BY kt.priority ASC, kt.created_at ASC
      LIMIT 5
    `).all(req.params.projectId)

    const result = tasks.map((t: any) => ({
      ...t,
      project_settings: JSON.parse(t.project_settings || '{}')
    }))
    res.json({ data: result, error: null })
  } catch (err: any) {
    console.error('Error fetching pending pipeline tasks:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// PATCH /api/kanban/:projectId/:taskId/pipeline — atualiza pipeline_status
router.patch('/:projectId/:taskId/pipeline', authenticateToken, (req: Request, res: Response) => {
  try {
    const { pipeline_status, workflow_id, error_message } = req.body
    db.prepare(`
      UPDATE kanban_tasks SET
        pipeline_status = COALESCE(?, pipeline_status),
        workflow_id = COALESCE(?, workflow_id),
        error_message = COALESCE(?, error_message),
        planning_started_at = CASE WHEN ? = 'planning' THEN datetime('now') ELSE planning_started_at END,
        updated_at = datetime('now')
      WHERE id = ? AND project_id = ?
    `).run(pipeline_status, workflow_id, error_message, pipeline_status, req.params.taskId, req.params.projectId)

    const updated = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(req.params.taskId)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    console.error('Error updating pipeline status:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

export default router

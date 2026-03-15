import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import { randomUUID } from 'crypto'

const router = Router()

// Helper function to parse tasks JSON string from SQLite
function parsePlan(row: any) {
  return {
    ...row,
    tasks: typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
  }
}

// Types for request bodies
interface CreatePlanBody {
  name: string
  tasks: any[] | string
  project_id?: string
}

interface StartPlanBody {
  client_id: string
}

interface CompletePlanBody {
  status: 'success' | 'failed'
  result: string
  result_status?: 'success' | 'partial' | 'needs_rework'
  result_notes?: string
  structured_output?: any
}

interface LogEntry {
  task_id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

// GET /api/plans - List all plans
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { project_id } = req.query
    const query = project_id
      ? `
        SELECT
          id,
          name,
          tasks,
          status,
          client_id,
          result,
          started_at,
          completed_at,
          created_at,
          project_id
        FROM plans
        WHERE project_id = ?
        ORDER BY created_at DESC
      `
      : `
        SELECT
          id,
          name,
          tasks,
          status,
          client_id,
          result,
          started_at,
          completed_at,
          created_at,
          project_id
        FROM plans
        ORDER BY created_at DESC
      `
    const plans = project_id
      ? db.prepare(query).all(project_id)
      : db.prepare(query).all()

    res.json({ data: plans.map(parsePlan), error: null })
  } catch (error) {
    console.error('Error fetching plans:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plans' })
  }
})

// POST /api/plans - Create a new plan
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { name, tasks, project_id, status: requestedStatus }: CreatePlanBody & { status?: string } = req.body

    if (!name || !tasks) {
      return res.status(400).json({ data: null, error: 'name and tasks are required' })
    }

    // Parse tasks if it's a string
    const parsedTasks = typeof tasks === 'string' ? JSON.parse(tasks) : tasks

    // Sanitize tasks to ensure each task has an id
    const sanitizedTasks = (parsedTasks || []).map((task: any, index: number) => ({
      ...task,
      id: task.id || `task-${index + 1}`,
    }))

    // Validate and set status (default to 'pending')
    const allowedStatuses = ['pending', 'awaiting_approval']
    const status = requestedStatus && allowedStatuses.includes(requestedStatus) ? requestedStatus : 'pending'

    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO plans (id, name, tasks, status, project_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, JSON.stringify(sanitizedTasks), status, project_id ?? null, now)

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.status(201).json({ data: parsePlan(plan), error: null })
  } catch (error) {
    console.error('Error creating plan:', error)
    res.status(500).json({ data: null, error: 'Failed to create plan' })
  }
})

// GET /api/plans/pending - Get pending plans (for client polling)
router.get('/pending', authenticateToken, (req: Request, res: Response) => {
  try {
    const plans = db
      .prepare(`
        SELECT
          id,
          name,
          tasks,
          status,
          client_id,
          result,
          started_at,
          completed_at,
          created_at
        FROM plans
        WHERE status = 'pending'
        ORDER BY created_at DESC
      `)
      .all()

    res.json({ data: plans.map(parsePlan), error: null })
  } catch (error) {
    console.error('Error fetching pending plans:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch pending plans' })
  }
})

// GET /api/plans/metrics - Get global plan statistics
router.get('/metrics', authenticateToken, (req: Request, res: Response) => {
  try {
    // Total plans
    const totalResult = db
      .prepare('SELECT COUNT(*) as n FROM plans')
      .get() as { n: number }
    const total = totalResult.n

    // Plans grouped by status
    const byStatusRows = db
      .prepare('SELECT status, COUNT(*) as count FROM plans GROUP BY status')
      .all() as { status: string; count: number }[]

    const by_status: Record<string, number> = {
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
    }

    for (const row of byStatusRows) {
      by_status[row.status] = row.count
    }

    // Success rate (successful / completed plans)
    const completedCount = (by_status.success || 0) + (by_status.failed || 0)
    const success_rate = completedCount > 0
      ? ((by_status.success || 0) / completedCount) * 100
      : 0

    // Average execution duration in seconds
    const avgDurationResult = db
      .prepare(`
        SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400) as avg_seconds
        FROM plans
        WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
      `)
      .get() as { avg_seconds: number | null }
    const avg_duration_seconds = avgDurationResult.avg_seconds || 0

    // Last 7 days metrics
    const last7DaysSuccess = db
      .prepare(`SELECT COUNT(*) as n FROM plans WHERE status = 'success' AND created_at > datetime('now', '-7 days')`)
      .get() as { n: number }
    const last7DaysFailed = db
      .prepare(`SELECT COUNT(*) as n FROM plans WHERE status = 'failed' AND created_at > datetime('now', '-7 days')`)
      .get() as { n: number }

    res.json({
      data: {
        total,
        by_status,
        success_rate: Math.round(success_rate * 100) / 100,
        avg_duration_seconds: Math.round(avg_duration_seconds * 100) / 100,
        last_7_days: {
          success: last7DaysSuccess.n,
          failed: last7DaysFailed.n,
        },
      },
      error: null,
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch metrics' })
  }
})

// PUT /api/plans/:id - Edit a plan (only pending or awaiting_approval)
router.put('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    // Só permite editar planos que ainda não iniciaram
    const editableStatuses = ['pending', 'awaiting_approval']
    if (!editableStatuses.includes(plan.status)) {
      return res.status(400).json({
        error: `Cannot edit plan with status '${plan.status}'. Only pending or awaiting_approval plans can be edited.`
      })
    }

    const { name, tasks } = req.body

    db.prepare(`
      UPDATE plans SET
        name = COALESCE(?, name),
        tasks = COALESCE(?, tasks)
      WHERE id = ?
    `).run(
      name || null,
      tasks ? JSON.stringify(tasks) : null,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (updated.tasks && typeof updated.tasks === 'string') {
      try { updated.tasks = JSON.parse(updated.tasks) } catch {}
    }
    res.json({ data: updated, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/plans/:id/approve - Approve a plan (awaiting_approval → pending)
router.post('/:id/approve', authenticateToken, (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }
    if (plan.status !== 'awaiting_approval') {
      return res.status(400).json({ error: `Plan status is '${plan.status}', not 'awaiting_approval'` })
    }
    db.prepare("UPDATE plans SET status = 'pending' WHERE id = ?").run(req.params.id)

    // Atualiza kanban task vinculada para in_progress
    db.prepare(`
      UPDATE kanban_tasks
      SET "column" = 'in_progress',
          pipeline_status = 'running',
          updated_at = datetime('now')
      WHERE workflow_id = ?
    `).run(req.params.id)

    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/plans/:id - Get plan detail with log count
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Get log count
    const logCount = db
      .prepare('SELECT COUNT(*) as count FROM plan_logs WHERE plan_id = ?')
      .get(id) as { count: number }

    const planWithLogCount = {
      ...parsePlan(plan),
      log_count: logCount.count,
    }

    // Parse structured_output if present
    if (plan.structured_output) {
      try {
        planWithLogCount.structured_output = JSON.parse(plan.structured_output)
      } catch (e) {
        // Invalid JSON, leave as is
        console.warn('Failed to parse structured_output for plan', id)
      }
    }

    res.json({ data: planWithLogCount, error: null })
  } catch (error) {
    console.error('Error fetching plan:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plan' })
  }
})

// POST /api/plans/:id/start - Start a plan
router.post('/:id/start', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { client_id }: StartPlanBody = req.body

    if (!client_id) {
      return res.status(400).json({ data: null, error: 'client_id is required' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status !== 'pending') {
      return res.status(400).json({ data: null, error: 'Plan is not in pending status' })
    }

    const now = new Date().toISOString()

    db.prepare(`
      UPDATE plans
      SET status = 'running',
          client_id = ?,
          started_at = ?
      WHERE id = ?
    `).run(client_id, now, id)

    const updatedPlan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updatedPlan), error: null })
  } catch (error) {
    console.error('Error starting plan:', error)
    res.status(500).json({ data: null, error: 'Failed to start plan' })
  }
})

// POST /api/plans/:id/complete - Complete a plan
router.post('/:id/complete', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, result, result_status, result_notes, structured_output }: CompletePlanBody = req.body

    if (!status || !result) {
      return res.status(400).json({ data: null, error: 'status and result are required' })
    }

    if (status !== 'success' && status !== 'failed') {
      return res.status(400).json({ data: null, error: 'status must be success or failed' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status !== 'running') {
      return res.status(400).json({ data: null, error: 'Plan is not in running status' })
    }

    const now = new Date().toISOString()

    db.prepare(`
      UPDATE plans
      SET status = ?,
          result = ?,
          completed_at = ?,
          result_status = COALESCE(?, result_status),
          result_notes = COALESCE(?, result_notes),
          structured_output = COALESCE(?, structured_output)
      WHERE id = ?
    `).run(
      status,
      result,
      now,
      result_status || null,
      result_notes || null,
      structured_output ? JSON.stringify(structured_output) : null,
      id
    )

    const updatedPlan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updatedPlan), error: null })
  } catch (error) {
    console.error('Error completing plan:', error)
    res.status(500).json({ data: null, error: 'Failed to complete plan' })
  }
})

// POST /api/plans/:id/logs - Append log entries
router.post('/:id/logs', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const logs: LogEntry[] = req.body

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ data: null, error: 'logs must be a non-empty array' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    const now = new Date().toISOString()
    const insertLog = db.prepare(`
      INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((logs: LogEntry[]) => {
      for (const log of logs) {
        insertLog.run(id, log.task_id, log.level, log.message, now)
      }
    })

    insertMany(logs)

    res.json({ data: { inserted: logs.length }, error: null })
  } catch (error) {
    console.error('Error appending logs:', error)
    res.status(500).json({ data: null, error: 'Failed to append logs' })
  }
})

// GET /api/plans/:id/logs - Get all log entries for a plan
router.get('/:id/logs', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    const logs = db
      .prepare(`
        SELECT
          id,
          plan_id,
          task_id,
          level,
          message,
          created_at
        FROM plan_logs
        WHERE plan_id = ?
        ORDER BY created_at ASC
      `)
      .all(id)

    res.json({ data: logs, error: null })
  } catch (error) {
    console.error('Error fetching logs:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch logs' })
  }
})

// POST /api/plans/:id/execute - Re-queue a failed or stuck plan for execution
router.post('/:id/execute', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status === 'running') {
      return res.status(409).json({ data: null, error: 'Plan is already running' })
    }

    db.prepare(`
      UPDATE plans
      SET status = 'pending',
          client_id = NULL,
          started_at = NULL,
          completed_at = NULL,
          result = NULL
      WHERE id = ?
    `).run(id)

    const updated = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updated), error: null })
  } catch (error) {
    console.error('Error executing plan:', error)
    res.status(500).json({ data: null, error: 'Failed to execute plan' })
  }
})

// POST /api/plans/:id/force-stop — força plano para 'failed' independente do status atual
router.post('/:id/force-stop', authenticateToken, (req, res) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) return res.status(404).json({ data: null, error: 'Plan not found' })
    if (plan.status !== 'running') {
      return res.status(409).json({ data: null, error: `Plan is not running (status: ${plan.status})` })
    }

    db.prepare(`
      UPDATE plans
      SET status = 'failed',
          completed_at = datetime('now'),
          result = 'Manually stopped by user'
      WHERE id = ?
    `).run(req.params.id)

    // Adicionar log de parada manual
    const { v4: uuid } = require('uuid')
    db.prepare(`
      INSERT INTO plan_logs (id, plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(uuid(), req.params.id, 'system', 'warn', '⛔ Plan manually stopped by user')

    return res.json({ data: { stopped: true }, error: null })
  } catch (err: any) {
    console.error('Error force stopping plan:', err)
    return res.status(500).json({ data: null, error: err.message || 'Failed to force stop plan' })
  }
})

// POST /api/plans/:id/resume — Resume a failed plan from where it left off
router.post('/:id/resume', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status === 'running') {
      return res.status(400).json({ data: null, error: 'Plan is already running' })
    }

    if (plan.status === 'success') {
      return res.status(400).json({ data: null, error: 'Plan already completed successfully' })
    }

    // Set status back to pending so daemon picks it up
    // Keep started_at to maintain execution history
    // Clear completed_at and result to allow re-execution
    db.prepare(`
      UPDATE plans
      SET status = 'pending',
          completed_at = NULL,
          result = NULL
      WHERE id = ?
    `).run(id)

    // Add log indicating resume
    const { v4: uuid } = require('uuid')
    db.prepare(`
      INSERT INTO plan_logs (id, plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(uuid(), id, 'system', 'info', '↻ Plan resumed - will skip completed tasks')

    return res.json({ data: { success: true, message: 'Plan queued for resume' }, error: null })
  } catch (error) {
    console.error('Error resuming plan:', error)
    res.status(500).json({ data: null, error: 'Failed to resume plan' })
  }
})

// DELETE /api/plans/:id - Delete a plan
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Don't allow deleting running plans
    if (plan.status === 'running') {
      return res.status(409).json({ data: null, error: 'Cannot delete a running plan' })
    }

    // Delete associated logs and then the plan
    db.prepare('DELETE FROM plan_logs WHERE plan_id = ?').run(id)
    db.prepare('DELETE FROM plans WHERE id = ?').run(id)

    res.json({ data: { deleted: true }, error: null })
  } catch (error) {
    console.error('Error deleting plan:', error)
    res.status(500).json({ data: null, error: 'Failed to delete plan' })
  }
})

// GET /api/plans/:id/logs/stream - SSE endpoint for real-time log streaming
router.get('/:id/logs/stream', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.flushHeaders()

  // Send initial batch of existing logs
  const existing = db
    .prepare('SELECT * FROM plan_logs WHERE plan_id = ? ORDER BY created_at ASC')
    .all(id) as any[]

  let lastId = 0
  for (const log of existing) {
    res.write(`data: ${JSON.stringify(log)}\n\n`)
    if (log.id > lastId) lastId = log.id
  }

  // Poll for new logs every 500ms
  const interval = setInterval(() => {
    // Check if plan still exists
    const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(id) as any
    if (!plan) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Plan not found' })}\n\n`)
      clearInterval(interval)
      res.end()
      return
    }

    // Fetch new logs since lastId
    const newLogs = db
      .prepare('SELECT * FROM plan_logs WHERE plan_id = ? AND id > ? ORDER BY id ASC')
      .all(id, lastId) as any[]

    for (const log of newLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`)
      if (log.id > lastId) lastId = log.id
    }

    // Send plan status update
    res.write(`event: status\ndata: ${JSON.stringify({ status: plan.status })}\n\n`)

    // Close stream when plan is terminal
    if (plan.status === 'success' || plan.status === 'failed') {
      res.write(`event: done\ndata: ${JSON.stringify({ status: plan.status })}\n\n`)
      clearInterval(interval)
      res.end()
    }
  }, 500)

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval)
  })
})

// Recover stuck plans on startup (running → failed if older than 30min)
export function recoverStuckPlans(db: any) {
  const timeoutMinutes = Number(process.env.PLAN_TIMEOUT_MINUTES ?? 10)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE plans
    SET status = 'failed',
        result = 'Plan timed out - daemon may have crashed',
        completed_at = datetime('now')
    WHERE status = 'running'
    AND started_at < ?
  `).run(cutoff)

  if (result.changes > 0) {
    console.log(`[recovery] Marked ${result.changes} stuck plan(s) as failed`)
  }
}

// POST /api/plans/:id/structured-output - Save structured output from quick actions
router.post('/:id/structured-output', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { output } = req.body

    if (!output) {
      return res.status(400).json({ data: null, error: 'output is required' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    db.prepare(
      'UPDATE plans SET structured_output = ? WHERE id = ?'
    ).run(JSON.stringify(output), id)

    return res.json({ data: { saved: true }, error: null })
  } catch (error) {
    console.error('Error saving structured output:', error)
    res.status(500).json({ data: null, error: 'Failed to save structured output' })
  }
})

export default router

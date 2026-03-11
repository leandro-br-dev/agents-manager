import express from 'express'
import cors from 'cors'
import { authenticateToken } from './middleware/auth.js'
import plansRouter, { recoverStuckPlans } from './routes/plans.js'
import workspacesRouter from './routes/workspaces.js'
import approvalsRouter from './routes/approvals.js'
import daemonRouter from './routes/daemon.js'
import projectsRouter from './routes/projects.js'
import nativeSkillsRouter from './routes/nativeSkills.js'
import quickActionsRouter from './routes/quickActions.js'
import chatSessionsRouter from './routes/chatSessions.js'
import { db } from './db/index.js'

const app = express()
const PORT = process.env.PORT || 3000

// Recover stuck plans on startup
recoverStuckPlans(db)

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (curl, Postman, daemon)
    if (!origin) return callback(null, true)
    // Permitir qualquer localhost independente da porta
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true)
    }
    // Em produção, adicionar domínios permitidos via env var
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',')
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Agents Manager API is running' })
})

// Protected routes
app.get('/api/agents', authenticateToken, (req, res) => {
  res.json({ agents: [] })
})

app.get('/api/workflows', authenticateToken, (req, res) => {
  res.json({ workflows: [] })
})

app.get('/api/executions', authenticateToken, (req, res) => {
  res.json({ executions: [] })
})

// Plans routes
app.use('/api/plans', plansRouter)

// Workspaces routes
app.use('/api/workspaces', workspacesRouter)

// Approvals routes
app.use('/api/approvals', approvalsRouter)

// Daemon routes
app.use('/api/daemon', daemonRouter)

// Projects routes
app.use('/api/projects', projectsRouter)

// Native skills routes
app.use('/api/native-skills', nativeSkillsRouter)

// Quick actions routes
app.use('/api/quick-actions', quickActionsRouter)

// Chat sessions routes
app.use('/api/sessions', chatSessionsRouter)

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

const server = app.listen(PORT, () => {
  console.log(`[api] Server running on port ${PORT}`)
  recoverStuckPlans(db)
})

// Run approval timeout check every minute
setInterval(() => {
  const timeoutMinutes = Number(process.env.APPROVAL_TIMEOUT_MINUTES ?? 10)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE approvals SET status = 'timeout', responded_at = datetime('now')
    WHERE status = 'pending' AND created_at < ?
  `).run(cutoff)
  if (result.changes > 0) {
    console.log(`[approvals] Timed out ${result.changes} pending approval(s)`)
  }
}, 60_000)

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] Port ${PORT} is already in use.`)
    console.error(`[api] Run: pkill -f 'tsx.*index.ts' to kill existing process`)
    process.exit(1)
  } else {
    throw err
  }
})

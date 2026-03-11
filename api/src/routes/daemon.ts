import { Router } from 'express'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Estado global do processo daemon
let daemonProcess: ChildProcess | null = null
let daemonLogs: string[] = []
const MAX_LOGS = 200

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLIENT_DIR = path.join(__dirname, '../../..', 'client')
const PYTHON = path.join(CLIENT_DIR, 'venv', 'bin', 'python')
const MAIN = path.join(CLIENT_DIR, 'main.py')

function getDaemonStatus() {
  if (!daemonProcess || daemonProcess.exitCode !== null) {
    return 'stopped'
  }
  try {
    process.kill(daemonProcess.pid!, 0)
    return 'running'
  } catch {
    return 'stopped'
  }
}

// GET /api/daemon/status
router.get('/status', authenticateToken, (req, res) => {
  const status = getDaemonStatus()
  return res.json({
    data: {
      status,
      pid: status === 'running' ? daemonProcess?.pid : null,
      logs: daemonLogs.slice(-50),
    },
    error: null,
  })
})

// POST /api/daemon/start
router.post('/start', authenticateToken, (req, res) => {
  if (getDaemonStatus() === 'running') {
    return res.status(409).json({ data: null, error: 'Daemon is already running' })
  }

  const token = process.env.AGENTS_MANAGER_TOKEN ?? 'dev-token-change-in-production'
  const apiUrl = `http://localhost:${process.env.PORT ?? 3000}`

  daemonLogs = []
  daemonProcess = spawn(PYTHON, ['main.py', '--daemon'], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env,
      AGENTS_MANAGER_URL: apiUrl,
      AGENTS_MANAGER_TOKEN: token,
    },
  })

  daemonProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    daemonLogs.push(...lines)
    if (daemonLogs.length > MAX_LOGS) daemonLogs = daemonLogs.slice(-MAX_LOGS)
  })

  daemonProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    daemonLogs.push(...lines.map(l => `[stderr] ${l}`))
    if (daemonLogs.length > MAX_LOGS) daemonLogs = daemonLogs.slice(-MAX_LOGS)
  })

  daemonProcess.on('exit', (code) => {
    daemonLogs.push(`[daemon] Process exited with code ${code}`)
  })

  return res.json({ data: { started: true, pid: daemonProcess.pid }, error: null })
})

// POST /api/daemon/stop
router.post('/stop', authenticateToken, (req, res) => {
  if (getDaemonStatus() !== 'running') {
    return res.status(409).json({ data: null, error: 'Daemon is not running' })
  }
  daemonProcess!.kill('SIGTERM')
  return res.json({ data: { stopped: true }, error: null })
})

export default router

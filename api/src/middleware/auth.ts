import { Request, Response, NextFunction } from 'express'

// Static bearer token (in production, this should be in environment variables)
const VALID_TOKEN = process.env.API_BEARER_TOKEN || 'dev-token-change-in-production'

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const headerToken = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  // Also support token via query parameter (for EventSource/SSE which doesn't support custom headers)
  const queryToken = req.query.token as string

  const token = headerToken || queryToken

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  if (token !== VALID_TOKEN) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  next()
}

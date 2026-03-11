import { useEffect, useRef, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'your-api-token'

export type LogLine = {
  id: number
  plan_id: string
  task_id: string
  level: string
  message: string
  created_at: string
}

type StreamStatus = 'connecting' | 'streaming' | 'done' | 'error'

export function useLogStream(planId: string, enabled: boolean) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!enabled || !planId) return

    // EventSource doesn't support custom headers, so we pass token via query parameter
    const url = `${API_BASE_URL}/api/plans/${planId}/logs/stream?token=${API_TOKEN}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setStreamStatus('streaming')

    es.onmessage = (event) => {
      const log: LogLine = JSON.parse(event.data)
      setLogs(prev => {
        // Dedup by id
        if (prev.some(l => l.id === log.id)) return prev
        return [...prev, log]
      })
    }

    es.addEventListener('status', () => {
      // Status updates from server — useful for debugging but not used currently
    })

    es.addEventListener('done', () => {
      setStreamStatus('done')
      es.close()
    })

    es.addEventListener('error', () => {
      setStreamStatus('error')
      es.close()
    })

    es.onerror = () => {
      // EventSource auto-reconnects, but if we get here it's a real error
      setStreamStatus('error')
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [planId, enabled])

  return { logs, streamStatus }
}

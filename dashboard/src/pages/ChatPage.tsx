import { useState, useEffect, useRef } from 'react'
import { Plus, Bot, Send, Zap, Trash2, MessageSquare, ChevronRight, RotateCcw } from 'lucide-react'
import {
  Button, EmptyState, ConfirmDialog, Select
} from '@/components'
import { useGetSessions, useGetSession, useCreateSession, useSendMessage, useDeleteSession, useDeleteMessage, useClearHistory } from '@/api/sessions'
import { useGetProjects } from '@/api/projects'
import { useGetWorkspaces } from '@/api/workspaces'
import { API_BASE_URL, API_TOKEN } from '@/api/client'

export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [input, setInput] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: sessions = [] } = useGetSessions()
  const { data: session } = useGetSession(selectedId ?? '')
  const sendMessage = useSendMessage(selectedId ?? '')
  const deleteSession = useDeleteSession()
  const deleteMessage = useDeleteMessage()
  const clearHistory = useClearHistory()

  // SSE for real-time updates
  useEffect(() => {
    if (!selectedId) return
    const evtSource = new EventSource(
      `${API_BASE_URL}/api/sessions/${selectedId}/stream?token=${API_TOKEN}`
    )
    evtSource.onmessage = () => {} // refresh is handled by polling for now
    return () => evtSource.close()
  }, [selectedId])

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [session?.messages?.length])

  // Detect structured_output in assistant messages
  useEffect(() => {
    if (!session?.messages) return
    const lastAssistant = [...session.messages]
      .reverse()
      .find((m: any) => m.role === 'assistant')
    if (!lastAssistant) return
    try {
      const parsed = JSON.parse(lastAssistant.content)
      if (parsed.structured_output?.type === 'plan' && !pendingPlan) {
        setPendingPlan(parsed.structured_output.content)
      }
    } catch {}
  }, [session?.messages])

  const handleSend = async () => {
    if (!input.trim() || !selectedId || session?.status === 'running') return
    const text = input.trim()
    setInput('')
    setPendingPlan(null)
    await sendMessage.mutateAsync(text)
  }

  const isRunning = session?.status === 'running'

  return (
    <div className="h-full flex">
      {/* Sessions sidebar */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <Button variant="primary" size="sm" onClick={() => setShowNew(true)} className="w-full">
            <Plus className="h-3.5 w-3.5" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare className="h-6 w-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No conversations yet</p>
            </div>
          ) : sessions.map((s: any) => (
            <div
              key={s.id}
              className={`group relative border-b border-gray-100 ${
                selectedId === s.id ? 'bg-gray-50 border-l-2 border-l-gray-900' : ''
              }`}
            >
              <button
                onClick={() => setSelectedId(s.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 truncate pr-6">{s.name}</span>
                  {s.status === 'running' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.updated_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </button>
              <button
                onClick={() => setDeleteConfirm(s.id)}
                className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-1"
                title="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Bot className="h-12 w-12" />}
            title="Select a conversation"
            description="Choose an existing chat or start a new one"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">{session?.name}</span>
              {isRunning && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full animate-pulse">Thinking...</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmClear(true)}
                className="text-gray-400 hover:text-amber-500"
                title="Clear chat history (resets context)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteConfirm(selectedId)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {(session?.messages ?? []).map((msg: any, msgIndex: number) => {
              let displayContent = msg.content
              let structuredOut = null
              try {
                const parsed = JSON.parse(msg.content)
                displayContent = parsed.text ?? msg.content
                structuredOut = parsed.structured_output
              } catch {}

              // Check if this is the last user message without a response
              const messages = session?.messages ?? []
              const isLastUserMsg = (
                msg.role === 'user' &&
                messages[messages.length - 1]?.id === msg.id
              )
              const hasResponse = messages.some(
                (m: any, i: number) => i > msgIndex && m.role === 'assistant'
              )
              const isPending = isLastUserMsg && !hasResponse && session?.status === 'running'

              return (
                <div
                  key={msg.id}
                  className={`flex group ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Delete button - visible on hover */}
                  <button
                    onClick={() => deleteMessage.mutate({ sessionId: selectedId!, messageId: msg.id })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity self-center mx-2 text-gray-300 hover:text-red-400"
                    title="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className={`max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5'
                      : 'bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5'
                  }`}>
                    <p className={`text-sm whitespace-pre-wrap ${
                      msg.role === 'user' ? 'text-white' : 'text-gray-700'
                    }`}>
                      {displayContent}
                    </p>

                    {/* Pending indicator */}
                    {isPending && (
                      <p className="text-xs mt-1 text-blue-300 animate-pulse">⏳ waiting for response...</p>
                    )}

                    {/* Structured output card */}
                    {structuredOut && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-semibold text-green-800 capitalize mb-1">
                          {structuredOut.type} generated
                        </p>
                        {structuredOut.type === 'plan' && (
                          <>
                            <p className="text-xs text-green-700">
                              {structuredOut.content?.name} • {structuredOut.content?.tasks?.length} tasks
                            </p>
                            <Button
                              variant="primary" size="sm"
                              className="mt-2"
                              onClick={() => { setPendingPlan(structuredOut.content); setShowPlanModal(true) }}
                            >
                              Review & Create Workflow
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    <p className="text-xs mt-1 opacity-50">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )
            })}

            {isRunning && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-gray-200 bg-white">
            {pendingPlan && (
              <div className="mb-3 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-green-800">Plan ready: {pendingPlan.name}</p>
                  <p className="text-xs text-green-600">{pendingPlan.tasks?.length} tasks</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowPlanModal(true)}>
                  <Zap className="h-3.5 w-3.5" /> Create Workflow
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={isRunning ? 'Agent is thinking...' : 'Type a message... (Enter to send, Shift+Enter for newline)'}
                disabled={isRunning}
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <Button
                variant="primary"
                onClick={handleSend}
                disabled={!input.trim() || isRunning}
                loading={sendMessage.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNew && (
        <NewChatModal
          onClose={() => setShowNew(false)}
          onCreate={id => { setSelectedId(id); setShowNew(false) }}
        />
      )}

      {/* Plan creation from chat */}
      {showPlanModal && pendingPlan && (
        <PlanCreateModal
          onClose={() => setShowPlanModal(false)}
          prefillData={pendingPlan}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete conversation?"
        description="All messages in this conversation will be permanently deleted."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm) {
            deleteSession.mutate(deleteConfirm)
            if (selectedId === deleteConfirm) setSelectedId(null)
          }
          setDeleteConfirm(null)
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear chat history?"
        description="All messages will be deleted and the conversation context will be reset. The agent will not remember previous messages."
        confirmLabel="Clear history"
        variant="danger"
        onConfirm={() => {
          clearHistory.mutate(selectedId!)
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
        loading={clearHistory.isPending}
      />
    </div>
  )
}

function NewChatModal({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const [projectId, setProjectId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [sessionName] = useState('')

  const { data: projects = [] } = useGetProjects()
  const { data: workspaces = [] } = useGetWorkspaces(projectId ? { project_id: projectId } : undefined)
  const selectedProject = projects.find(p => p.id === projectId)
  const environments = selectedProject?.environments ?? []
  const selectedWs = workspaces.find(ws => ws.id === workspaceId)
  const createSession = useCreateSession()

  const handleCreate = async () => {
    if (!selectedWs) return
    const result = await createSession.mutateAsync({
      name: sessionName || `Chat with ${selectedWs.name}`,
      project_id: projectId || undefined,
      workspace_path: selectedWs.path,
      environment_id: environmentId || undefined,
    })
    onCreate((result as any).id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">New Chat Session</h3>

        <Select label="Project" value={projectId} onChange={e => { setProjectId(e.target.value); setWorkspaceId('') }}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>

        <Select label="Agent *" value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} required>
          <option value="" disabled>Select agent...</option>
          {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
        </Select>

        {environments.length > 0 && (
          <Select label="Environment" value={environmentId} onChange={e => setEnvironmentId(e.target.value)}>
            <option value="">No specific environment</option>
            {environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary" size="sm"
            onClick={handleCreate}
            disabled={!workspaceId}
            loading={createSession.isPending}
          >
            Start Chat
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PlanCreateModalProps {
  onClose: () => void
  prefillData: any
}

function PlanCreateModal({ onClose, prefillData }: PlanCreateModalProps) {
  const navigate = (path: string) => {
    window.location.href = path
  }

  const handleCreateFromPlan = () => {
    // For now, navigate to plans page with the prefill data
    // In a full implementation, we'd pass this through state or a temporary store
    onClose()
    navigate('/plans/new')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-2xl w-full mx-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Review Generated Plan</h3>
            <p className="text-xs text-gray-500 mt-1">{prefillData?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {prefillData?.tasks?.map((task: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{idx + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{task.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{task.prompt}</p>
                  {task.depends_on && task.depends_on.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Depends on: {task.depends_on.join(', ')}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Discard</Button>
          <Button
            variant="primary" size="sm"
            onClick={handleCreateFromPlan}
          >
            <Zap className="h-3.5 w-3.5" /> Create Workflow
          </Button>
        </div>
      </div>
    </div>
  )
}

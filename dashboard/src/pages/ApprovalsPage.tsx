import { AlertTriangle, Check, CheckCircle, X } from 'lucide-react'
import { useGetPendingApprovals, useRespondApproval, type Approval } from '@/api/approvals'

export default function ApprovalsPage() {
  const { data: approvals = [], isLoading } = useGetPendingApprovals()
  const respond = useRespondApproval()

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
        {approvals.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-sm font-medium">
            {approvals.length} pending
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No pending approvals</p>
          <p className="text-gray-400 text-sm mt-1">The agent will pause here when it needs permission</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(approval => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecision={(decision) => respond.mutate({ id: approval.id, decision })}
              isLoading={respond.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ApprovalCard({ approval, onDecision, isLoading }: {
  approval: Approval
  onDecision: (d: 'approved' | 'denied') => void
  isLoading: boolean
}) {
  const inputData = (() => {
    try { return JSON.parse(approval.input) }
    catch { return approval.input }
  })()

  const ageSeconds = Math.round((Date.now() - new Date(approval.created_at).getTime()) / 1000)
  const ageLabel = ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.round(ageSeconds/60)}m ago`

  return (
    <div className="border border-amber-200 rounded-lg p-5 bg-amber-50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-semibold text-gray-900 font-mono">{approval.tool}</span>
          <span className="text-gray-500 text-sm ml-2">
            plan{' '}
            <a href={`/plans/${approval.plan_id}`} className="underline hover:text-gray-700">
              {approval.plan_name ?? approval.plan_id.slice(0, 8)}
            </a>
            {' '}/ task{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{approval.task_id}</code>
          </span>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{ageLabel}</span>
      </div>

      {approval.reason && (
        <p className="text-sm text-amber-800 mb-3 flex items-start gap-1.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {approval.reason}
        </p>
      )}

      <pre className="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto mb-4 max-h-40 whitespace-pre-wrap">
        {typeof inputData === 'object'
          ? JSON.stringify(inputData, null, 2)
          : String(inputData)}
      </pre>

      <div className="flex gap-3">
        <button
          onClick={() => onDecision('approved')}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Approve
        </button>
        <button
          onClick={() => onDecision('denied')}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Deny
        </button>
      </div>
    </div>
  )
}

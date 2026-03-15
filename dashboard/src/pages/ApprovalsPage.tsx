import { AlertTriangle, Check, CheckCircle, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useGetPendingApprovals, useRespondApproval, type Approval } from '@/api/approvals'
import { useApprovePlan, type Plan } from '@/api/plans'
import { apiClient } from '@/api/client'
import { PageHeader, Button, EmptyState } from '@/components'

export default function ApprovalsPage() {
  const { data: approvals = [], isLoading } = useGetPendingApprovals()
  const respond = useRespondApproval()
  const navigate = useNavigate()
  const approvePlan = useApprovePlan()

  // Fetch plans awaiting approval
  const { data: pendingPlans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ['plans', 'awaiting_approval'],
    queryFn: async () => {
      const all = await apiClient.get<Plan[]>('/api/plans');
      return all.filter(p => p.status === 'awaiting_approval');
    },
    refetchInterval: 5000,
  })

  const totalPending = approvals.length + pendingPlans.length

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <PageHeader
        title="Approval Queue"
        description={totalPending > 0 ? `${totalPending} pending approval${totalPending > 1 ? 's' : ''}` : undefined}
      />

      {(isLoading || isLoadingPlans) ? (
        <EmptyState title="Loading..." />
      ) : approvals.length === 0 && pendingPlans.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="h-12 w-12 text-green-400" />}
          title="No pending approvals"
          description="The agent will pause here when it needs permission"
        />
      ) : (
        <div className="space-y-6">
          {/* Workflow Approvals Section */}
          {pendingPlans.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                Workflow Approvals ({pendingPlans.length})
              </h2>
              <div className="space-y-2">
                {pendingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                      <p className="text-xs text-gray-500">
                        {plan.tasks?.length ?? 0} tasks · Created {new Date(plan.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/plans/${plan.id}`, {
                          state: { from: '/approvals', fromLabel: 'Approvals' }
                        })}
                      >
                        Review
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approvePlan.mutate(plan.id)}
                        loading={approvePlan.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool Use Approvals Section */}
          {approvals.length > 0 && (
            <div>
              {pendingPlans.length > 0 && (
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  Tool Use Approvals ({approvals.length})
                </h2>
              )}
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
            </div>
          )}
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
        <Button
          onClick={() => onDecision('approved')}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700 border-green-600"
        >
          <Check className="h-4 w-4" /> Approve
        </Button>
        <Button
          onClick={() => onDecision('denied')}
          disabled={isLoading}
          variant="danger"
        >
          <X className="h-4 w-4" /> Deny
        </Button>
      </div>
    </div>
  )
}

import { Link } from 'react-router';
import { useGetMetrics, useGetPlans, type PlanStatus } from '@/api/plans';
import { cn } from '@/lib/utils';

const statusColors = {
  pending: 'bg-yellow-500',
  running: 'bg-blue-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
};

interface StatusDotProps {
  status: PlanStatus;
  size?: 'sm' | 'md';
}

function StatusDot({ status, size = 'sm' }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';
  return (
    <span className={cn('inline-block rounded-full', sizeClass, statusColors[status])} />
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold text-gray-900">
        {value}
        {unit && <span className="text-lg font-normal text-gray-500 ml-1">{unit}</span>}
      </dd>
    </div>
  );
}

export default function WorkflowsPage() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useGetMetrics();
  const { data: plans, isLoading: plansLoading } = useGetPlans();

  if (metricsLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading workflows...</div>
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading metrics: {(metricsError as Error).message}</div>
      </div>
    );
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlanDuration = (plan: any): string => {
    if (!plan.started_at || !plan.completed_at) {
      return plan.started_at ? 'Running...' : '—';
    }
    const duration = (new Date(plan.completed_at).getTime() - new Date(plan.started_at).getTime()) / 1000;
    return formatDuration(duration);
  };

  const sortedPlans = plans
    ? [...plans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor your agent workflows and execution metrics
        </p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total plans" value={metrics.total} />
          <MetricCard
            label="Success rate"
            value={metrics.success_rate.toFixed(1)}
            unit="%"
          />
          <MetricCard
            label="Avg duration"
            value={formatDuration(metrics.avg_duration_seconds)}
          />
          <MetricCard label="Last 7 days" value={`${metrics.last_7_days.success}✓ ${metrics.last_7_days.failed}✗`} />
        </div>
      )}

      {/* Status Breakdown */}
      {metrics && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-base font-semibold leading-7 text-gray-900">Status Breakdown</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <StatusDot status="pending" size="md" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Pending</div>
                  <div className="text-xs text-gray-500">{metrics.by_status.pending} plans</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status="running" size="md" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Running</div>
                  <div className="text-xs text-gray-500">{metrics.by_status.running} plans</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status="success" size="md" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Success</div>
                  <div className="text-xs text-gray-500">{metrics.by_status.success} plans</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status="failed" size="md" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Failed</div>
                  <div className="text-xs text-gray-500">{metrics.by_status.failed} plans</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution History */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-base font-semibold leading-7 text-gray-900">Execution History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Plan
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Tasks
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Duration
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Client
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  When
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                    No execution history available
                  </td>
                </tr>
              ) : (
                sortedPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <Link
                        to={`/plans/${plan.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-900"
                      >
                        {plan.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <StatusDot status={plan.status} />
                        <span className="capitalize">{plan.status}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {plan.tasks.length}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {getPlanDuration(plan)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {plan.client_id || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {formatDate(plan.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

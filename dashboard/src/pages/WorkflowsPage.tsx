import { useState, useRef } from 'react'
import { Link } from 'react-router'
import { Plus, Upload, Loader2 } from 'lucide-react'
import {
  PageHeader,
  Button,
  MetricCard,
  StatusBadge,
  EmptyState,
  Pagination,
} from '@/components'
import { useGetPlans, useGetMetrics, useCreatePlan } from '@/api/plans'
import { useGetProjects } from '@/api/projects'

const PAGE_SIZE = 15

export default function WorkflowsPage() {
  const [page, setPage] = useState(1)
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const { data: metrics } = useGetMetrics()
  const { data: allPlans = [], isLoading, error } = useGetPlans()
  const { data: projects = [] } = useGetProjects()
  const importPlan = useCreatePlan()

  // Filter by project
  const projectFiltered = projectFilter
    ? allPlans.filter((p: any) => p.project_id === projectFilter)
    : allPlans

  // Filter by status on frontend
  const filtered = statusFilter
    ? projectFiltered.filter((p: any) => p.status === statusFilter)
    : projectFiltered

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const json = JSON.parse(await file.text())
      if (!json.name || !Array.isArray(json.tasks)) {
        alert('Invalid JSON: must have "name" and "tasks" array')
        return
      }
      await importPlan.mutateAsync({
        name: json.name,
        tasks: json.tasks,
        project_id: projectFilter || undefined,
      })
      e.target.value = ''
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON'}`)
    }
  }

  const handleExport = (plan: any) => {
    const tasks = Array.isArray(plan.tasks)
      ? plan.tasks
      : JSON.parse(plan.tasks ?? '[]')
    const blob = new Blob(
      [JSON.stringify({ name: plan.name, tasks }, null, 2)],
      { type: 'application/json' }
    )
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${plan.name.replace(/\s+/g, '-').toLowerCase()}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const formatDuration = (s: number) =>
    s < 60
      ? `${s}s`
      : s < 3600
        ? `${Math.round(s / 60)}m`
        : `${(s / 3600).toFixed(1)}h`

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading workflows...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          Error loading workflows: {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <PageHeader
        title="Workflows"
        description="Monitor your agent workflows and execution metrics"
        actions={
          <>
            {/* Project filter */}
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value)
                setPage(1)
              }}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Import */}
            <label
              className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 ${
                importPlan.isPending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {importPlan.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import
                </>
              )}
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                disabled={importPlan.isPending}
                onChange={handleImport}
              />
            </label>

            <Button
              variant="primary"
              onClick={() => (window.location.href = '/plans/new')}
            >
              <Plus className="h-4 w-4" /> New Workflow
            </Button>
          </>
        }
      />

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard
            label="Success rate"
            value={`${metrics.success_rate}%`}
            color={
              metrics.success_rate >= 70
                ? 'green'
                : metrics.success_rate >= 40
                  ? 'amber'
                  : 'red'
            }
          />
          <MetricCard
            label="Avg duration"
            value={formatDuration(metrics.avg_duration_seconds)}
          />
          <MetricCard
            label="Last 7 days"
            value={`${metrics.last_7_days.success}✓ ${metrics.last_7_days.failed}✗`}
          />
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4">
        {['', 'pending', 'running', 'success', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s)
              setPage(1)
            }}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              statusFilter === s
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== '' && metrics?.by_status?.[s as keyof typeof metrics.by_status] ? (
              <span className="ml-1.5 text-xs opacity-70">
                {metrics.by_status[s as keyof typeof metrics.by_status]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState
            title={
              statusFilter
                ? `No ${statusFilter} workflows`
                : 'No workflows yet'
            }
            description={
              statusFilter
                ? 'Try clearing the filter'
                : 'Create your first workflow to get started'
            }
          />
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Tasks
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  When
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((plan: any) => {
                const tasks = Array.isArray(plan.tasks) ? plan.tasks : []
                const duration =
                  plan.started_at && plan.completed_at
                    ? Math.round(
                        (new Date(plan.completed_at).getTime() -
                          new Date(plan.started_at).getTime()) /
                          1000
                      )
                    : null
                return (
                  <tr
                    key={plan.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/plans/${plan.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-gray-600"
                      >
                        {plan.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={plan.status} animate />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {tasks.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {duration !== null ? formatDuration(duration) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">
                      {plan.client_id?.split('-')[0] ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(plan.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleExport(plan)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                        title="Export as JSON"
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}

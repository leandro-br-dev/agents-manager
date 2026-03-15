const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:           { bg: 'bg-gray-100',   text: 'text-gray-600',  dot: 'bg-gray-400',  label: 'Pending' },
  running:           { bg: 'bg-blue-50',    text: 'text-blue-700',  dot: 'bg-blue-500',  label: 'Running' },
  success:           { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500', label: 'Success' },
  failed:            { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500',   label: 'Failed' },
  timeout:           { bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500', label: 'Timeout' },
  approved:          { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500', label: 'Approved' },
  denied:            { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500',   label: 'Denied' },
  awaiting_approval: { bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500', label: 'Awaiting Approval' },
}

interface StatusBadgeProps {
  status: string
  animate?: boolean  // pulsa quando running
}

export function StatusBadge({ status, animate }: StatusBadgeProps) {
  const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: status }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${animate && status === 'running' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}

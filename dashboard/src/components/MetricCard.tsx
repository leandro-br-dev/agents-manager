interface MetricCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  color?: 'default' | 'green' | 'red' | 'amber'
}

export function MetricCard({ label, value, color = 'default' }: MetricCardProps) {
  const colors = {
    default: 'text-gray-900',
    green:   'text-green-600',
    red:     'text-red-600',
    amber:   'text-amber-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${colors[color]}`}>{value}</p>
    </div>
  )
}

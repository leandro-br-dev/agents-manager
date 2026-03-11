import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, className = '', ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      <select
        className={`
          w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white
          focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-400
          ${error ? 'border-red-400' : ''} ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

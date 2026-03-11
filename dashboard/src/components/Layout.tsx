import { Outlet, Link, useLocation } from 'react-router-dom'
import { Settings, Users, Workflow, AlertCircle, FolderOpen } from 'lucide-react'
import { useGetPendingApprovals } from '@/api/approvals'

export default function Layout() {
  const location = useLocation()
  const { data: pendingApprovals = [] } = useGetPendingApprovals()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-xl font-bold">Agents Manager</h1>
        </div>
        <nav className="mt-6">
          <NavItem icon={<Workflow size={20} />} label="Workflows" href="/" isActive={location.pathname === '/' || location.pathname === '/workflows'} />
          <NavItem icon={<FolderOpen size={20} />} label="Projects" href="/projects" isActive={location.pathname === '/projects'} />
          <NavItem icon={<Users size={20} />} label="Agents" href="/agents" isActive={location.pathname === '/agents'} />
          <NavItem
            icon={<AlertCircle size={20} />}
            label="Approvals"
            href="/approvals"
            isActive={location.pathname === '/approvals'}
            badge={pendingApprovals.length > 0 ? pendingApprovals.length : undefined}
          />
          <NavItem icon={<Settings size={20} />} label="Settings" href="/settings" isActive={location.pathname === '/settings'} />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto font-sans">
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({
  icon,
  label,
  href,
  isActive,
  badge
}: {
  icon: React.ReactNode
  label: string
  href: string
  isActive?: boolean
  badge?: number
}) {
  return (
    <Link
      to={href}
      className={`flex items-center justify-between gap-3 px-6 py-3 transition-colors ${
        isActive
          ? 'bg-gray-800 text-white border-l-4 border-white'
          : 'text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[24px] text-center font-semibold">
          {badge}
        </span>
      )}
    </Link>
  )
}

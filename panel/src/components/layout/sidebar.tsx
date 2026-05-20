import { Link, useLocation } from '@tanstack/react-router'
import {
  Building2,
  FileText,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings,
  Webhook,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/licenses', label: 'Licenses', icon: KeyRound },
]

export function Sidebar() {
  const { logout, user } = useAuth()
  const location = useLocation()

  const settingsActive =
    location.pathname === '/settings' || location.pathname.startsWith('/settings/')

  const initials = (user?.displayName ?? user?.email ?? 'U')
    .split(/[\s@]/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-zinc-950 border-r border-zinc-900">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-zinc-900">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-500/30">
          <Fingerprint className="h-4 w-4 text-indigo-400" />
        </div>
        <span className="text-sm font-semibold text-white tracking-tight">Sigil</span>
        {user?.isOperator && (
          <span className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-900 text-zinc-500">
            operator
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {mainNav.map((item) => {
          const Icon = item.icon
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to + '/'))
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-indigo-400')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-zinc-900 px-2 pb-3 pt-2 space-y-0.5">
        <Link
          to="/settings/webhooks"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
            location.pathname.startsWith('/settings/webhooks')
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
          )}
        >
          <Webhook
            className={cn(
              'h-4 w-4 shrink-0',
              location.pathname.startsWith('/settings/webhooks') && 'text-indigo-400',
            )}
          />
          Webhooks
        </Link>
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
            settingsActive
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
          )}
        >
          <Settings className={cn('h-4 w-4 shrink-0', settingsActive && 'text-indigo-400')} />
          Settings
        </Link>

        <button
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-zinc-900 group"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-medium text-zinc-300">
              {user?.displayName ?? user?.email ?? 'User'}
            </p>
            {user?.displayName && (
              <p className="truncate text-[11px] text-zinc-600">{user.email}</p>
            )}
          </div>
          <LogOut className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
        </button>
      </div>
    </aside>
  )
}

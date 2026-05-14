import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api, type License } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/lib/status'
import { ArrowRight, Building2, Clock, FileText, KeyRound } from 'lucide-react'

export const Route = createFileRoute('/_layout/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [companies, templates, licenses] = await Promise.all([
        api.get('/panel/companies').then((r) => r.data),
        api.get('/panel/templates').then((r) => r.data),
        api.get('/panel/licenses').then((r) => r.data),
      ])
      return { companies, templates, licenses: licenses as License[] }
    },
  })

  const expiring = useMemo(() => {
    const now = Date.now()
    const limit = 30 * 24 * 60 * 60 * 1000
    return (data?.licenses ?? []).filter((l) => {
      if (!l.expiresAt) return false
      const diff = new Date(l.expiresAt).getTime() - now
      return diff > 0 && diff < limit
    }).length
  }, [data])

  const recentLicenses = useMemo(
    () =>
      [...(data?.licenses ?? [])]
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
        .slice(0, 6),
    [data],
  )

  const stats = [
    {
      label: 'Companies',
      value: data?.companies?.length ?? 0,
      icon: Building2,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Templates',
      value: data?.templates?.length ?? 0,
      icon: FileText,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Licenses',
      value: data?.licenses?.length ?? 0,
      icon: KeyRound,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Expiring in 30d',
      value: expiring,
      icon: Clock,
      iconBg: expiring > 0 ? 'bg-amber-50' : 'bg-zinc-50',
      iconColor: expiring > 0 ? 'text-amber-600' : 'text-zinc-400',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Overview of your licensing platform</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-zinc-500">{item.label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-8 w-16" />
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-zinc-900">
                      {item.value.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className={`rounded-xl p-2.5 ${item.iconBg}`}>
                  <Icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Licenses */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Recent Licenses</h2>
          <Link
            to="/licenses"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentLicenses.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="rounded-full bg-zinc-100 p-3.5">
                <KeyRound className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-700">No licenses yet</p>
              <p className="mt-1 text-sm text-zinc-400">Issue your first license to get started.</p>
              <Link
                to="/licenses"
                className="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Go to Licenses →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {recentLicenses.map((l) => (
                <Link
                  key={l.id}
                  to="/licenses/$licenseId"
                  params={{ licenseId: l.id }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50/70 transition-colors"
                >
                  <code className="text-sm font-mono font-medium text-zinc-800">
                    {l.licenseKey}
                  </code>
                  <span className="text-xs text-zinc-400">
                    {l.expiresAt
                      ? `Expires ${new Date(l.expiresAt).toLocaleDateString()}`
                      : 'No expiry'}
                  </span>
                  <div className="ml-auto">
                    <StatusBadge status={l.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

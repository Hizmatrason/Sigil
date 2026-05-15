import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api, type License } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/lib/status'
import { ArrowRight, Building2, CheckCircle2, Clock, FileText, KeyRound } from 'lucide-react'

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

  const hasCompanies = (data?.companies?.length ?? 0) > 0
  const hasTemplates = (data?.templates?.length ?? 0) > 0
  const hasLicenses = (data?.licenses?.length ?? 0) > 0
  const showOnboarding = !isLoading && !hasLicenses

  const stats = [
    {
      label: 'Companies',
      value: data?.companies?.length ?? 0,
      icon: Building2,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      to: '/companies',
    },
    {
      label: 'Templates',
      value: data?.templates?.length ?? 0,
      icon: FileText,
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
      to: '/templates',
    },
    {
      label: 'Licenses',
      value: data?.licenses?.length ?? 0,
      icon: KeyRound,
      iconBg: 'bg-indigo-500/15',
      iconColor: 'text-indigo-400',
      to: '/licenses',
    },
    {
      label: 'Expiring in 30d',
      value: expiring,
      icon: Clock,
      iconBg: expiring > 0 ? 'bg-amber-500/15' : 'bg-muted',
      iconColor: expiring > 0 ? 'text-amber-400' : 'text-muted-foreground/40',
      to: '/licenses',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your licensing platform</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.label} to={item.to} className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-8 w-16" />
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {item.value.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className={`rounded-xl p-2.5 ${item.iconBg}`}>
                  <Icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Onboarding guide — shown until first license is issued */}
      {showOnboarding && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Getting Started</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Follow these steps to issue your first license.
            </p>
          </div>
          <div className="space-y-3">
            <OnboardingStep
              done={hasCompanies}
              step={1}
              title="Create a company"
              description="Companies represent your customers or tenants. Licenses are issued to companies."
              action={{ label: 'Go to Companies', to: '/companies' }}
            />
            <OnboardingStep
              done={hasTemplates}
              step={2}
              title="Create a license template"
              description="Templates define the license structure, default validity, and config schema for your product."
              action={{ label: 'Go to Templates', to: '/templates' }}
            />
            <OnboardingStep
              done={false}
              step={3}
              title="Issue your first license"
              description="Pick a company and template, fill in the config, and Sigil will sign it with Ed25519."
              action={{ label: 'Issue License', to: '/licenses' }}
            />
          </div>
        </div>
      )}

      {/* Recent Licenses */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Licenses</h2>
          <Link
            to="/licenses"
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border/50">
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
              <div className="rounded-full bg-muted p-3.5">
                <KeyRound className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">No licenses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Issue your first license to get started.</p>
              <Link
                to="/licenses"
                className="mt-4 text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                Go to Licenses →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentLicenses.map((l) => (
                <Link
                  key={l.id}
                  to="/licenses/$licenseId"
                  params={{ licenseId: l.id }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <code className="text-sm font-mono font-medium text-foreground">
                    {l.licenseKey}
                  </code>
                  <span className="text-xs text-muted-foreground">
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

function OnboardingStep({
  done,
  step,
  title,
  description,
  action,
}: {
  done: boolean
  step: number
  title: string
  description: string
  action: { label: string; to: string }
}) {
  return (
    <div className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
      done
        ? 'border-border/50 bg-muted/10 opacity-60'
        : 'border-border bg-muted/20'
    }`}>
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-500/50">
            <span className="text-[10px] font-bold text-indigo-400">{step}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {!done && (
        <Link
          to={action.to}
          className="shrink-0 rounded-md bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:bg-indigo-500/25 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

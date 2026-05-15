import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, type Company, type License } from '@/lib/api'
import { StatusBadge } from '@/lib/status'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Building2 } from 'lucide-react'

export const Route = createFileRoute('/_layout/companies/$companyId')({
  component: CompanyDetailPage,
})

function CompanyDetailPage() {
  const { companyId } = Route.useParams()

  const { data: company, isLoading } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: async () => {
      const { data } = await api.get<Company>(`/panel/companies/${companyId}`)
      return data
    },
  })

  const { data: children } = useQuery({
    queryKey: ['companies', companyId, 'children'],
    queryFn: async () => {
      const { data } = await api.get<Company[]>(`/panel/companies/${companyId}/children`)
      return data
    },
  })

  const { data: licenses } = useQuery({
    queryKey: ['licenses', { companyId }],
    queryFn: async () => {
      const { data } = await api.get<License[]>(`/panel/licenses?companyId=${companyId}`)
      return data
    },
  })

  if (isLoading || !company) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground/60">
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/companies"
          className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-foreground/80 hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-foreground">{company.name}</h1>
            <StatusBadge status={company.status} />
          </div>
          <code className="mt-0.5 text-xs text-muted-foreground/60">{company.path}</code>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCell label="Slug" value={<code className="font-mono">{company.slug}</code>} />
          <InfoCell label="Status" value={<StatusBadge status={company.status} />} />
          <InfoCell
            label="Created"
            value={new Date(company.createdAt).toLocaleDateString()}
          />
          {company.contactEmail && (
            <InfoCell label="Contact" value={company.contactEmail} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="children">
        <TabsList className="bg-zinc-100">
          <TabsTrigger value="children">
            Children
            {children && children.length > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                {children.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="licenses">
            Licenses
            {licenses && licenses.length > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                {licenses.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="children" className="mt-5">
          {children?.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-12 text-center">
              <Building2 className="h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-sm text-muted-foreground">No child companies</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-zinc-100">
              {children?.map((child) => (
                <Link
                  key={child.id}
                  to="/companies/$companyId"
                  params={{ companyId: child.id }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{child.name}</p>
                    <code className="text-xs text-muted-foreground/60">{child.slug}</code>
                  </div>
                  <StatusBadge status={child.status} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="licenses" className="mt-5">
          {licenses?.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-12 text-center">
              <p className="text-sm text-muted-foreground">No licenses for this company</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-zinc-100">
              {licenses?.map((l) => (
                <Link
                  key={l.id}
                  to="/licenses/$licenseId"
                  params={{ licenseId: l.id }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <code className="text-sm font-mono font-medium text-zinc-800">
                    {l.licenseKey}
                  </code>
                  <span className="text-xs text-muted-foreground/60">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground/60">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground/80">{value}</p>
    </div>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  api,
  type License,
  type Company,
  type LicenseTemplate,
  type Activation,
  type HeartbeatEntry,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/lib/status'
import { Activity, ArrowLeft, Download, Key, Monitor, ShieldOff } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_layout/licenses/$licenseId')({
  component: LicenseDetailPage,
})

function LicenseDetailPage() {
  const { licenseId } = Route.useParams()
  const queryClient = useQueryClient()
  const [revokeReason, setRevokeReason] = useState('')

  const { data: license, isLoading } = useQuery({
    queryKey: ['licenses', licenseId],
    queryFn: async () => {
      const { data } = await api.get<License>(`/panel/licenses/${licenseId}`)
      return data
    },
  })

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await api.get<Company[]>('/panel/companies')
      return data
    },
  })

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get<LicenseTemplate[]>('/panel/templates')
      return data
    },
  })

  const { data: activations } = useQuery({
    queryKey: ['licenses', licenseId, 'activations'],
    queryFn: async () => {
      const { data } = await api.get<Activation[]>(`/panel/licenses/${licenseId}/activations`)
      return data
    },
  })

  const { data: heartbeats } = useQuery({
    queryKey: ['licenses', licenseId, 'heartbeats'],
    queryFn: async () => {
      const { data } = await api.get<HeartbeatEntry[]>(`/panel/licenses/${licenseId}/heartbeats`)
      return data
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (reason: string) => {
      await api.post(`/panel/licenses/${licenseId}/revoke`, { reason })
    },
    onSuccess: () => {
      toast.success('License revoked')
      queryClient.invalidateQueries({ queryKey: ['licenses', licenseId] })
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      setRevokeReason('')
    },
    onError: () => toast.error('Failed to revoke license'),
  })

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/panel/licenses/${licenseId}/download`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `${license?.licenseKey ?? 'license'}.sigil`
      link.click()
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Download started'),
    onError: () => toast.error('Failed to download'),
  })

  const downloadPubKeyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<string>(`/panel/licenses/${licenseId}/public-key`)
      const blob = new Blob([data], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${license?.licenseKey ?? 'license'}.pub`
      link.click()
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Public key downloaded'),
    onError: () => toast.error('Failed to download public key'),
  })

  if (isLoading || !license) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground/60">
        Loading…
      </div>
    )
  }

  const company = companies?.find((c) => c.id === license.companyId)
  const template = templates?.find((t) => t.id === license.templateId)

  let configObj: Record<string, unknown> = {}
  try {
    configObj = JSON.parse(license.config || '{}')
  } catch {
    configObj = { raw: license.config }
  }

  const activeActivations = activations?.filter((a) => a.status === 'Active') ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/licenses"
          className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold text-foreground">{license.licenseKey}</h1>
            <StatusBadge status={license.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {company?.name ?? 'Unknown company'}
            {template && (
              <>
                {' · '}
                <Link
                  to="/templates/$templateId"
                  params={{ templateId: template.id }}
                  className="hover:text-indigo-400 transition-colors"
                >
                  {template.name}
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            .sigil
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPubKeyMutation.mutate()}
            disabled={downloadPubKeyMutation.isPending}
          >
            <Key className="mr-1.5 h-3.5 w-3.5" />
            Public key
          </Button>
          {license.status === 'Active' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                  Revoke
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke license?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The license will be permanently revoked and
                    the client will be blocked at the next heartbeat.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="Enter revocation reason…"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => revokeMutation.mutate(revokeReason)}
                    className="bg-destructive text-destructive-foreground"
                    disabled={revokeMutation.isPending}
                  >
                    {revokeMutation.isPending ? 'Revoking…' : 'Revoke License'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">
            Activity
            {activeActivations.length > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                {activeActivations.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Details tab ── */}
        <TabsContent value="details" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Details</h2>
              <div className="space-y-2.5">
                <Row label="Company">{company?.name ?? license.companyId}</Row>
                <Row label="Template">{template?.name ?? license.templateId}</Row>
                <Row label="Status">
                  <StatusBadge status={license.status} />
                </Row>
                <Row label="Issued">{new Date(license.issuedAt).toLocaleString()}</Row>
                {license.activatedAt && (
                  <Row label="Activated">{new Date(license.activatedAt).toLocaleString()}</Row>
                )}
                {license.expiresAt && (
                  <Row label="Expires">
                    <span className={new Date(license.expiresAt) < new Date() ? 'text-red-400' : undefined}>
                      {new Date(license.expiresAt).toLocaleString()}
                    </span>
                  </Row>
                )}
                {license.lastHeartbeatAt && (
                  <Row label="Last heartbeat">
                    {new Date(license.lastHeartbeatAt).toLocaleString()}
                  </Row>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Configuration</h2>
              <pre className="rounded-lg border border-border/50 bg-muted/20 p-3.5 text-xs font-mono overflow-auto max-h-72 text-foreground/80 leading-relaxed">
                {JSON.stringify(configObj, null, 2)}
              </pre>
            </div>
          </div>
        </TabsContent>

        {/* ── Activity tab ── */}
        <TabsContent value="activity" className="mt-5 space-y-5">
          {/* Activations */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Activations
                {activations && activations.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {activations.length} total
                  </span>
                )}
              </h2>
            </div>

            {!activations || activations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activations yet.</p>
            ) : (
              <div className="space-y-2">
                {activations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/10 px-3.5 py-3"
                  >
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        a.status === 'Active' ? 'bg-emerald-400' : 'bg-muted-foreground/30'
                      }`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {a.machineName ?? 'Unknown machine'}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            a.status === 'Active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      {a.hwFingerprint && (
                        <p className="font-mono text-xs text-muted-foreground/60 truncate">
                          {a.hwFingerprint.slice(0, 16)}…
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>Activated {new Date(a.activatedAt).toLocaleString()}</span>
                        {a.lastHeartbeatAt && (
                          <span>Last heartbeat {new Date(a.lastHeartbeatAt).toLocaleString()}</span>
                        )}
                        {a.deactivatedAt && (
                          <span>Deactivated {new Date(a.deactivatedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Heartbeat timeline */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Heartbeat Timeline
                {heartbeats && heartbeats.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    last {heartbeats.length}
                  </span>
                )}
              </h2>
            </div>

            {!heartbeats || heartbeats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No heartbeats recorded yet.</p>
            ) : (
              <HeartbeatTimeline heartbeats={heartbeats} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function HeartbeatTimeline({ heartbeats }: { heartbeats: HeartbeatEntry[] }) {
  // Group by day
  const byDay = new Map<string, HeartbeatEntry[]>()
  for (const hb of heartbeats) {
    const day = new Date(hb.occurredAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(hb)
  }

  return (
    <div className="space-y-4">
      {[...byDay.entries()].map(([day, entries]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{day}</p>
          <div className="flex flex-wrap gap-1.5">
            {entries.map((hb) => (
              <div
                key={hb.id}
                title={new Date(hb.occurredAt).toLocaleTimeString()}
                className="h-5 w-5 rounded-sm bg-emerald-500/25 hover:bg-emerald-500/50 transition-colors cursor-default"
              />
            ))}
          </div>
        </div>
      ))}
      <p className="mt-2 text-xs text-muted-foreground/50">
        Each square = one heartbeat. Hover for time.
      </p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground/60">{label}</span>
      <span className="text-right text-foreground/80">{children}</span>
    </div>
  )
}

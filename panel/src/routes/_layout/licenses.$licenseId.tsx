import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, type License, type Company, type LicenseTemplate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ArrowLeft, Download, Key, ShieldOff } from 'lucide-react'
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
      <div className="flex items-center justify-center py-20 text-sm text-zinc-400">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/licenses"
          className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold text-zinc-900">{license.licenseKey}</h1>
            <StatusBadge status={license.status} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">
            {company?.name ?? 'Unknown company'}
            {template && (
              <>
                {' · '}
                <Link
                  to="/templates/$templateId"
                  params={{ templateId: template.id }}
                  className="hover:text-indigo-600 transition-colors"
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

      {/* Details grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Details</h2>
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
                <span
                  className={
                    new Date(license.expiresAt) < new Date()
                      ? 'text-red-600'
                      : undefined
                  }
                >
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

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Configuration</h2>
          <pre className="rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 text-xs font-mono overflow-auto max-h-72 text-zinc-700 leading-relaxed">
            {JSON.stringify(configObj, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="shrink-0 text-zinc-400">{label}</span>
      <span className="text-right text-zinc-700">{children}</span>
    </div>
  )
}

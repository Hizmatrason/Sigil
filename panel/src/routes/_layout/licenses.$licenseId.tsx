import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  api,
  type License,
  type Company,
  type LicenseTemplate,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ShieldOff, Download, Key } from 'lucide-react'
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
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  }

  const company = companies?.find((c) => c.id === license.companyId)
  const template = templates?.find((t) => t.id === license.templateId)

  const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Active: 'default',
    Expired: 'secondary',
    Revoked: 'destructive',
  }

  let configObj: Record<string, unknown> = {}
  try {
    configObj = JSON.parse(license.config || '{}')
  } catch {
    configObj = { raw: license.config }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/licenses" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight font-mono">{license.licenseKey}</h2>
            <Badge variant={statusVariant[license.status] ?? 'secondary'}>
              {license.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {company?.name ?? 'Unknown'} · {template?.name ?? 'Unknown template'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
        >
          <Download className="mr-2 h-4 w-4" />
          .sigil
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadPubKeyMutation.mutate()}
          disabled={downloadPubKeyMutation.isPending}
        >
          <Key className="mr-2 h-4 w-4" />
          PubKey
        </Button>
        {license.status === 'Active' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <ShieldOff className="mr-2 h-4 w-4" />
                Revoke
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke License?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The license will be permanently revoked.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Enter revocation reason..."
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => revokeMutation.mutate(revokeReason)}
                  className="bg-destructive text-destructive-foreground"
                >
                  {revokeMutation.isPending ? 'Revoking...' : 'Revoke License'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Company">{company?.name ?? license.companyId}</DetailRow>
            <DetailRow label="Template">{template?.name ?? license.templateId}</DetailRow>
            <DetailRow label="Status">
              <Badge variant={statusVariant[license.status] ?? 'secondary'}>
                {license.status}
              </Badge>
            </DetailRow>
            <DetailRow label="Issued">
              {new Date(license.issuedAt).toLocaleString()}
            </DetailRow>
            {license.activatedAt && (
              <DetailRow label="Activated">
                {new Date(license.activatedAt).toLocaleString()}
              </DetailRow>
            )}
            {license.expiresAt && (
              <DetailRow label="Expires">
                {new Date(license.expiresAt).toLocaleString()}
              </DetailRow>
            )}
            {license.lastHeartbeatAt && (
              <DetailRow label="Last Heartbeat">
                {new Date(license.lastHeartbeatAt).toLocaleString()}
              </DetailRow>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded bg-muted p-3 text-xs font-mono overflow-auto max-h-64">
              {JSON.stringify(configObj, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

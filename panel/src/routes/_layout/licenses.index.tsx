import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  api,
  type License,
  type LicenseTokenResponse,
  type IssueLicenseRequest,
  type Company,
  type LicenseTemplate,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Copy, Check } from 'lucide-react'
import { useState } from 'react'

const issueSchema = z.object({
  companyId: z.string().min(1, 'Company is required'),
  templateId: z.string().min(1, 'Template is required'),
  config: z.string().min(1, 'Config is required'),
  expiresAt: z.string().optional(),
  offlineDays: z.coerce.number().min(0).optional(),
  hwFingerprint: z.string().optional(),
})

type IssueForm = z.infer<typeof issueSchema>

export const Route = createFileRoute('/_layout/licenses/')({
  component: LicensesPage,
})

function LicensesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [issuedToken, setIssuedToken] = useState<LicenseTokenResponse | null>(null)

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const { data } = await api.get<License[]>('/panel/licenses')
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

  const issueMutation = useMutation({
    mutationFn: async (req: IssueLicenseRequest) => {
      const { data } = await api.post<LicenseTokenResponse>('/panel/licenses', req)
      return data
    },
    onSuccess: (data) => {
      toast.success('License issued successfully')
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      setIssuedToken(data)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to issue license')
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      config: '{}',
      offlineDays: 30,
    },
  })

  const selectedTemplateId = watch('templateId')
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId)

  const onSubmit = (data: IssueForm) => {
    issueMutation.mutate({
      companyId: data.companyId,
      templateId: data.templateId,
      config: data.config,
      expiresAt: data.expiresAt || undefined,
      offlineDays: data.offlineDays,
      hwFingerprint: data.hwFingerprint || undefined,
    })
  }

  const handleClose = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setIssuedToken(null)
      reset()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Licenses</h2>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Issue License
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{issuedToken ? 'License Issued' : 'Issue License'}</DialogTitle>
            </DialogHeader>
            {issuedToken ? (
              <IssuedTokenDisplay token={issuedToken} onClose={() => handleClose(false)} />
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select onValueChange={(v) => setValue('companyId', v, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.companyId && (
                    <p className="text-xs text-destructive">{errors.companyId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select onValueChange={(v) => setValue('templateId', v, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.productCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.templateId && (
                    <p className="text-xs text-destructive">{errors.templateId.message}</p>
                  )}
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">
                      Offline: {selectedTemplate.defaultOfflineDays}d · Validity:{' '}
                      {selectedTemplate.defaultValidityDays}d
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="config">Config (JSON)</Label>
                  <Textarea id="config" {...register('config')} rows={4} className="font-mono text-xs" />
                  {errors.config && (
                    <p className="text-xs text-destructive">{errors.config.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Expires At</Label>
                    <Input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="offlineDays">Offline Days</Label>
                    <Input id="offlineDays" type="number" {...register('offlineDays', { valueAsNumber: true })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hwFingerprint">HW Fingerprint (optional)</Label>
                  <Input id="hwFingerprint" {...register('hwFingerprint')} placeholder="Auto if empty" />
                </div>

                <Button type="submit" className="w-full" disabled={issueMutation.isPending}>
                  {issueMutation.isPending ? 'Issuing...' : 'Issue License'}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Key</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Issued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No licenses yet. Issue one to get started.
                    </TableCell>
                  </TableRow>
                )}
                {licenses?.map((license) => {
                  const company = companies?.find((c) => c.id === license.companyId)
                  const template = templates?.find((t) => t.id === license.templateId)
                  return (
                    <TableRow key={license.id}>
                      <TableCell>
                        <Link
                          to="/licenses/$licenseId"
                          params={{ licenseId: license.id }}
                          className="font-mono text-sm hover:underline"
                        >
                          {license.licenseKey}
                        </Link>
                      </TableCell>
                      <TableCell>{company?.name ?? license.companyId}</TableCell>
                      <TableCell>{template?.name ?? license.templateId}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            license.status === 'Active'
                              ? 'default'
                              : license.status === 'Revoked'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {license.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {license.expiresAt
                          ? new Date(license.expiresAt).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell>{new Date(license.issuedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Issued Token Display ──────────────────────────────────────────────────

function IssuedTokenDisplay({
  token,
  onClose,
}: {
  token: LicenseTokenResponse
  onClose: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
        <p className="text-sm font-medium text-green-600">✓ License issued successfully</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">License Key</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => copy('key', token.licenseKey)}
            >
              {copied === 'key' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <code className="block rounded bg-background p-2 text-sm font-mono">{token.licenseKey}</code>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Signed Token</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => copy('token', token.token)}
            >
              {copied === 'token' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <pre className="rounded bg-background p-2 text-xs font-mono overflow-auto max-h-32 break-all">
            {token.token}
          </pre>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Public Key (hex)</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => copy('pubkey', token.publicKey)}
            >
              {copied === 'pubkey' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <code className="block rounded bg-background p-2 text-xs font-mono break-all">
            {token.publicKey}
          </code>
        </div>
      </div>

      <Button className="w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}

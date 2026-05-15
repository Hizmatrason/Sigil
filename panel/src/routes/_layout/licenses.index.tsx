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
  type TemplateVersion,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/lib/status'
import { ArrowRight, Check, Copy, KeyRound, Plus, Search } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'

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

function generateDefaultFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const properties = schema.properties as Record<string, { type?: string; default?: unknown }> | undefined
  if (!properties) return result
  for (const [key, prop] of Object.entries(properties)) {
    if ('default' in prop) {
      result[key] = prop.default
    } else {
      switch (prop.type) {
        case 'string': result[key] = ''; break
        case 'number': result[key] = 0; break
        case 'boolean': result[key] = false; break
        case 'array': result[key] = []; break
        case 'object': result[key] = {}; break
        default: result[key] = null
      }
    }
  }
  return result
}

function formatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
}

function LicensesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [issuedToken, setIssuedToken] = useState<LicenseTokenResponse | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filtered = useMemo(() => {
    if (!licenses) return []
    return licenses.filter((l) => {
      const q = search.toLowerCase()
      const company = companies?.find((c) => c.id === l.companyId)
      const template = templates?.find((t) => t.id === l.templateId)
      const matchesSearch =
        !q ||
        l.licenseKey.toLowerCase().includes(q) ||
        (company?.name ?? '').toLowerCase().includes(q) ||
        (template?.name ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [licenses, search, statusFilter, companies, templates])

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
    defaultValues: { config: '{}', offlineDays: 30 },
  })

  const selectedTemplateId = watch('templateId')
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId)

  const { data: templateVersions } = useQuery({
    queryKey: ['templates', selectedTemplateId, 'versions'],
    queryFn: async () => {
      const { data } = await api.get<TemplateVersion[]>(`/panel/templates/${selectedTemplateId}/versions`)
      return data
    },
    enabled: !!selectedTemplateId,
  })

  const currentVersion = useMemo(() => {
    if (!selectedTemplate || !templateVersions) return null
    return templateVersions.find((v) => v.id === selectedTemplate.currentVersionId) ?? null
  }, [selectedTemplate, templateVersions])

  useEffect(() => {
    if (!currentVersion) return
    try {
      const schema = JSON.parse(currentVersion.configSchema)
      const defaults = generateDefaultFromSchema(schema)
      setValue('config', JSON.stringify(defaults, null, 2), { shouldValidate: false })
    } catch {
      // leave as is if schema is invalid
    }
  }, [currentVersion, setValue])

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Licenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and issue signed license tokens
          </p>
        </div>
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
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Select onValueChange={(v) => setValue('companyId', v, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company…" />
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

                <div className="space-y-1.5">
                  <Label>Template</Label>
                  <Select onValueChange={(v) => setValue('templateId', v, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{' '}
                          <span className="text-muted-foreground">({t.productCode})</span>
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

                <div className="space-y-1.5">
                  <Label htmlFor="config">
                    Config (JSON)
                    {currentVersion && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        auto-populated from schema v{currentVersion.version}
                      </span>
                    )}
                  </Label>
                  <Textarea
                    id="config"
                    {...register('config')}
                    rows={5}
                    className="font-mono text-xs"
                  />
                  {errors.config && (
                    <p className="text-xs text-destructive">{errors.config.message}</p>
                  )}
                  {currentVersion && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Schema reference (v{currentVersion.version}) ▾
                      </summary>
                      <pre className="mt-1.5 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs font-mono overflow-auto max-h-32 text-muted-foreground">
                        {formatJson(currentVersion.configSchema)}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="expiresAt">Expires At</Label>
                    <Input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="offlineDays">Offline Days</Label>
                    <Input
                      id="offlineDays"
                      type="number"
                      {...register('offlineDays', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hwFingerprint">HW Fingerprint</Label>
                  <Input
                    id="hwFingerprint"
                    {...register('hwFingerprint')}
                    placeholder="Optional — leave blank to skip"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={issueMutation.isPending}>
                  {issueMutation.isPending ? 'Issuing…' : 'Issue License'}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key, company, template…"
            className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Revoked">Revoked</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                License Key
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Company
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Template
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Expires
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Issued
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/50">
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>
                  <div className="flex flex-col items-center py-14 text-center">
                    <div className="rounded-full bg-muted p-3.5">
                      <KeyRound className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {licenses?.length === 0 ? 'No licenses yet' : 'No results'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {licenses?.length === 0
                        ? 'Issue your first license to get started.'
                        : 'Try adjusting your search or filter.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((license) => {
                const company = companies?.find((c) => c.id === license.companyId)
                const template = templates?.find((t) => t.id === license.templateId)
                return (
                  <TableRow
                    key={license.id}
                    className="border-border/50 hover:bg-muted/20"
                  >
                    <TableCell>
                      <Link
                        to="/licenses/$licenseId"
                        params={{ licenseId: license.id }}
                        className="font-mono text-sm font-medium text-foreground hover:text-indigo-400 transition-colors"
                      >
                        {license.licenseKey}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company?.name ?? (
                        <span className="text-muted-foreground/40 font-mono text-xs">
                          {license.companyId.slice(0, 8)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {template?.name ?? (
                        <span className="text-muted-foreground/40 font-mono text-xs">
                          {license.templateId.slice(0, 8)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={license.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {license.expiresAt
                        ? new Date(license.expiresAt).toLocaleDateString()
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(license.issuedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/licenses/$licenseId"
                        params={{ licenseId: license.id }}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                      >
                        View
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
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
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-sm font-medium text-emerald-400">
        ✓ License issued and signed successfully
      </div>

      <div className="space-y-3">
        <CopyField
          label="License Key"
          value={token.licenseKey}
          isCopied={copied === 'key'}
          onCopy={() => copy('key', token.licenseKey)}
          mono
        />
        <CopyField
          label="Signed Token"
          value={token.token}
          isCopied={copied === 'token'}
          onCopy={() => copy('token', token.token)}
          mono
          multiline
        />
        <CopyField
          label="Public Key (hex)"
          value={token.publicKey}
          isCopied={copied === 'pubkey'}
          onCopy={() => copy('pubkey', token.publicKey)}
          mono
        />
      </div>

      <Button className="w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}

function CopyField({
  label,
  value,
  isCopied,
  onCopy,
  mono,
  multiline,
}: {
  label: string
  value: string
  isCopied: boolean
  onCopy: () => void
  mono?: boolean
  multiline?: boolean
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {isCopied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {multiline ? (
        <pre className="w-full max-w-full overflow-x-auto rounded-lg border border-border bg-muted/20 p-2.5 text-xs font-mono max-h-24 whitespace-pre-wrap break-all text-foreground/80">
          {value}
        </pre>
      ) : (
        <div
          className={`min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs break-all text-foreground/80 ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </div>
      )}
    </div>
  )
}

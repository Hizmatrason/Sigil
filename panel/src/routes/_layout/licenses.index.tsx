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
import { Check, Copy, KeyRound, Plus } from 'lucide-react'
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
    defaultValues: { config: '{}', offlineDays: 30 },
  })

  const selectedTemplate = templates?.find((t) => t.id === watch('templateId'))

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
          <h1 className="text-xl font-semibold text-zinc-900">Licenses</h1>
          <p className="mt-1 text-sm text-zinc-500">
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
                    <p className="text-xs text-zinc-500">
                      Offline: {selectedTemplate.defaultOfflineDays}d · Validity:{' '}
                      {selectedTemplate.defaultValidityDays}d
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="config">Config (JSON)</Label>
                  <Textarea
                    id="config"
                    {...register('config')}
                    rows={4}
                    className="font-mono text-xs"
                  />
                  {errors.config && (
                    <p className="text-xs text-destructive">{errors.config.message}</p>
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

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                License Key
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Company
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Template
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Status
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Expires
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Issued
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-zinc-100">
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))
            ) : licenses?.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center py-14 text-center">
                    <div className="rounded-full bg-zinc-100 p-3.5">
                      <KeyRound className="h-6 w-6 text-zinc-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-700">No licenses yet</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Issue your first license to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              licenses?.map((license) => {
                const company = companies?.find((c) => c.id === license.companyId)
                const template = templates?.find((t) => t.id === license.templateId)
                return (
                  <TableRow
                    key={license.id}
                    className="border-zinc-100 hover:bg-zinc-50/50"
                  >
                    <TableCell>
                      <Link
                        to="/licenses/$licenseId"
                        params={{ licenseId: license.id }}
                        className="font-mono text-sm font-medium text-zinc-800 hover:text-indigo-600 transition-colors"
                      >
                        {license.licenseKey}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {company?.name ?? (
                        <span className="text-zinc-400 font-mono text-xs">
                          {license.companyId.slice(0, 8)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {template?.name ?? (
                        <span className="text-zinc-400 font-mono text-xs">
                          {license.templateId.slice(0, 8)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={license.status} />
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {license.expiresAt
                        ? new Date(license.expiresAt).toLocaleDateString()
                        : <span className="text-zinc-300">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {new Date(license.issuedAt).toLocaleDateString()}
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
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
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
        <pre className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs font-mono overflow-auto max-h-24 break-all text-zinc-700">
          {value}
        </pre>
      ) : (
        <div
          className={`rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs break-all text-zinc-700 ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </div>
      )}
    </div>
  )
}

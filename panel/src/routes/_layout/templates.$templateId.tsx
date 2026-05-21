import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  api,
  type LicenseTemplate,
  type TemplateVersion,
  type UpdateTemplateRequest,
  type CreateTemplateVersionRequest,
  type SigningKey,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/lib/status'
import { Archive, ArrowLeft, BookOpen, Edit, Plus, RotateCcw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export const Route = createFileRoute('/_layout/templates/$templateId')({
  component: TemplateDetailPage,
})

function TemplateDetailPage() {
  const { templateId } = Route.useParams()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)

  const { data: template, isLoading } = useQuery({
    queryKey: ['templates', templateId],
    queryFn: async () => {
      const { data } = await api.get<LicenseTemplate>(`/panel/templates/${templateId}`)
      return data
    },
  })

  const { data: versions } = useQuery({
    queryKey: ['templates', templateId, 'versions'],
    queryFn: async () => {
      const { data } = await api.get<TemplateVersion[]>(`/panel/templates/${templateId}/versions`)
      return data
    },
  })

  const { data: signingKeys } = useQuery({
    queryKey: ['templates', templateId, 'signing-keys'],
    queryFn: async () => {
      const { data } = await api.get<SigningKey[]>(`/panel/templates/${templateId}/signing-keys`)
      return data
    },
  })

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SigningKey>(`/panel/templates/${templateId}/signing-keys/rotate`)
      return data
    },
    onSuccess: () => {
      toast.success('New signing key generated — old key is now Rotating')
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'signing-keys'] })
    },
    onError: () => toast.error('Key rotation failed'),
  })

  const retireMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await api.post(`/panel/templates/${templateId}/signing-keys/${keyId}/retire`)
    },
    onSuccess: () => {
      toast.success('Key retired')
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'signing-keys'] })
    },
    onError: () => toast.error('Failed to retire key'),
  })

  const updateMutation = useMutation({
    mutationFn: async (req: UpdateTemplateRequest) => {
      const { data } = await api.put<LicenseTemplate>(`/panel/templates/${templateId}`, req)
      return data
    },
    onSuccess: () => {
      toast.success('Template updated')
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] })
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setEditOpen(false)
    },
    onError: () => toast.error('Failed to update template'),
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/panel/templates/${templateId}`)
    },
    onSuccess: () => {
      toast.success('Template archived')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] })
    },
    onError: () => toast.error('Failed to archive template'),
  })

  const versionMutation = useMutation({
    mutationFn: async (req: CreateTemplateVersionRequest) => {
      const { data } = await api.post<TemplateVersion>(
        `/panel/templates/${templateId}/versions`,
        req,
      )
      return data
    },
    onSuccess: () => {
      toast.success('Version created')
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'versions'] })
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] })
      setVersionOpen(false)
    },
    onError: () => toast.error('Failed to create version'),
  })

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/templates"
          className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-foreground">{template.name}</h1>
            <StatusBadge status={template.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{template.productCode}</code>
            {template.description && (
              <span className="ml-2 text-muted-foreground/60">{template.description}</span>
            )}
          </p>
        </div>

        {template.status !== 'Archived' && (
          <div className="flex gap-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Template</DialogTitle>
                </DialogHeader>
                <EditTemplateForm
                  template={template}
                  onSubmit={(data) => updateMutation.mutate(data)}
                  isPending={updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-muted-foreground hover:text-destructive">
                  <Archive className="mr-1.5 h-3.5 w-3.5" />
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will archive &ldquo;{template.name}&rdquo;. Existing licenses
                    remain unaffected and will continue to work.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => archiveMutation.mutate()}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions">
            Versions
            {versions && versions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {versions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">General</h3>
              <div className="space-y-2.5">
                <Row label="Status">
                  <StatusBadge status={template.status} />
                </Row>
                <Row label="Product Code">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {template.productCode}
                  </code>
                </Row>
                <Row label="Description">
                  {template.description || (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </Row>
                <Row label="Created">
                  {new Date(template.createdAt).toLocaleString()}
                </Row>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Defaults</h3>
              <div className="space-y-2.5">
                <Row label="Offline Days">{template.defaultOfflineDays} days</Row>
                <Row label="Validity Days">{template.defaultValidityDays} days</Row>
                <Row label="Current Version">
                  {template.currentVersionId ? (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {template.currentVersionId.slice(0, 8)}…
                    </code>
                  ) : (
                    <span className="text-amber-500 text-xs">No version yet</span>
                  )}
                </Row>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="mt-5">
          <div className="mb-4 flex justify-end">
            <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Version
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Create Version</DialogTitle>
                </DialogHeader>
                <CreateVersionForm
                  onSubmit={(data) => versionMutation.mutate(data)}
                  isPending={versionMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {versions?.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-14 text-center">
              <p className="text-sm font-medium text-foreground">No versions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a version to define a config schema.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions?.map((v) => (
                <div key={v.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs font-semibold text-foreground/80">
                        v{v.version}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground/60 font-mono">
                      {v.signingKeyId.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Config Schema</p>
                    <pre className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs font-mono overflow-auto max-h-40 text-foreground/80">
                      {formatJson(v.configSchema)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Signing keys</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ed25519 key pairs used to sign license tokens for this template.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={rotateMutation.isPending}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Rotate key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rotate signing key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A new Ed25519 key pair will be generated and become the active signing key.
                      The current key will be marked <strong>Rotating</strong> — existing tokens
                      signed with it remain valid. Retire the old key manually once all licenses
                      have been reissued.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => rotateMutation.mutate()}>
                      Rotate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="space-y-2">
              {signingKeys?.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-muted-foreground">
                        {key.id.slice(0, 8)}…
                      </code>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          key.status === 'Active' && 'bg-emerald-500/15 text-emerald-400',
                          key.status === 'Rotating' && 'bg-yellow-500/15 text-yellow-400',
                          key.status === 'Retired' && 'bg-zinc-500/15 text-zinc-400',
                          key.status === 'Compromised' && 'bg-red-500/15 text-red-400',
                        )}
                      >
                        {key.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-mono text-muted-foreground/60 truncate">
                      {key.publicKeyHex}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                    {key.notAfter && (
                      <p className="text-[11px] text-muted-foreground/60">
                        retired {new Date(key.notAfter).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {key.status === 'Rotating' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                      disabled={retireMutation.isPending}
                      onClick={() => retireMutation.mutate(key.id)}
                    >
                      Retire
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <details className="rounded-xl border border-border bg-card text-sm">
              <summary className="cursor-pointer select-none px-4 py-3 font-medium text-foreground">
                About key rotation
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-2 text-muted-foreground text-sm">
                <p>
                  <strong className="text-foreground">Active</strong> — this key signs all new license tokens.
                  Only one key per template can be Active at a time.
                </p>
                <p>
                  <strong className="text-foreground">Rotating</strong> — the key is no longer used for
                  signing but is still referenced in existing tokens. Tokens signed with this key
                  remain valid for verification.
                </p>
                <p>
                  <strong className="text-foreground">Retired</strong> — the key is considered decommissioned.
                  Retire a Rotating key after all licenses have been reissued with the new key.
                </p>
                <p>
                  <strong className="text-foreground">When to rotate</strong> — rotate if the private key
                  file is compromised, or as part of a scheduled security policy.
                </p>
              </div>
            </details>
          </div>
        </TabsContent>
      </Tabs>
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

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function EditTemplateForm({
  template,
  onSubmit,
  isPending,
}: {
  template: LicenseTemplate
  onSubmit: (data: UpdateTemplateRequest) => void
  isPending: boolean
}) {
  const { register, handleSubmit } = useForm<UpdateTemplateRequest>({
    defaultValues: {
      name: template.name,
      productCode: template.productCode,
      description: template.description ?? '',
      defaultOfflineDays: template.defaultOfflineDays,
      defaultValidityDays: template.defaultValidityDays,
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="productCode">Product Code</Label>
        <Input id="productCode" {...register('productCode')} className="font-mono" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="defaultOfflineDays">Offline Days</Label>
          <Input
            id="defaultOfflineDays"
            type="number"
            {...register('defaultOfflineDays', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="defaultValidityDays">Validity Days</Label>
          <Input
            id="defaultValidityDays"
            type="number"
            {...register('defaultValidityDays', { valueAsNumber: true })}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  )
}

const EXAMPLE_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      maxSeats: { type: 'number', default: 5, description: 'Max concurrent users' },
      tier: { type: 'string', default: 'standard', description: 'License tier' },
      features: { type: 'array', default: ['core'], description: 'Enabled feature flags' },
      analytics: { type: 'boolean', default: false, description: 'Analytics module' },
    },
    required: ['maxSeats', 'tier'],
  },
  null,
  2,
)

function CreateVersionForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: CreateTemplateVersionRequest) => void
  isPending: boolean
}) {
  const { register, handleSubmit, setValue } = useForm<CreateTemplateVersionRequest>({
    defaultValues: {
      configSchema: JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2),
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
      {/* Schema guide */}
      <details className="group rounded-lg border border-border bg-muted/20 text-xs">
        <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2.5 font-medium text-muted-foreground hover:text-foreground">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          Schema Guide
          <span className="ml-auto text-[10px] font-normal text-muted-foreground/50 group-open:hidden">
            click to expand
          </span>
        </summary>

        <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">
          <p className="leading-relaxed text-muted-foreground">
            A <span className="font-medium text-foreground">config schema</span> is a{' '}
            <a
              href="https://json-schema.org"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline"
            >
              JSON Schema
            </a>{' '}
            object that defines the fields each license of this template will carry. Sigil
            auto-populates those fields with defaults when you issue a license.
          </p>

          {/* Example */}
          <div>
            <p className="mb-1.5 font-semibold text-foreground">Example — SaaS product</p>
            <pre className="max-h-36 overflow-auto rounded-md border border-border/50 bg-muted/40 p-2.5 font-mono leading-relaxed text-foreground/80">
              {EXAMPLE_SCHEMA}
            </pre>
            <button
              type="button"
              onClick={() => setValue('configSchema', EXAMPLE_SCHEMA, { shouldValidate: false })}
              className="mt-1.5 rounded px-2 py-1 text-[11px] font-medium text-indigo-400 transition-colors hover:bg-indigo-500/10"
            >
              ← Use this example
            </button>
          </div>

          {/* Type reference */}
          <div>
            <p className="mb-2 font-semibold text-foreground">Property types</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {(
                [
                  ['string', 'text value'],
                  ['number', 'integer or decimal'],
                  ['boolean', 'true / false'],
                  ['array', 'list of values'],
                  ['object', 'nested object'],
                ] as const
              ).map(([type, desc]) => (
                <div key={type} className="flex items-baseline gap-1.5">
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/80">
                    {type}
                  </code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span className="mt-px text-indigo-400">→</span>
              Add{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/80">
                "default"
              </code>{' '}
              to any property to pre-fill it when issuing a license.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-px text-indigo-400">→</span>
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/80">
                "required"
              </code>{' '}
              is an array of field names that must be present.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-px text-indigo-400">→</span>
              Add{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/80">
                "description"
              </code>{' '}
              to any property to document its purpose.
            </li>
          </ul>
        </div>
      </details>

      <div className="space-y-1.5">
        <Label htmlFor="configSchema">Config Schema</Label>
        <Textarea
          id="configSchema"
          {...register('configSchema')}
          rows={10}
          className="font-mono text-xs"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Version'}
      </Button>
    </form>
  )
}

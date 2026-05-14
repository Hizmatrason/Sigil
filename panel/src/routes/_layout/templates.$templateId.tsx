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
import { Archive, ArrowLeft, Edit, Plus } from 'lucide-react'
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
      <div className="flex items-center justify-center py-20 text-sm text-zinc-400">
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
          className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-zinc-900">{template.name}</h1>
            <StatusBadge status={template.status} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{template.productCode}</code>
            {template.description && (
              <span className="ml-2 text-zinc-400">{template.description}</span>
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
                <Button variant="outline" size="sm" className="text-zinc-500 hover:text-destructive">
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
        <TabsList className="bg-zinc-100">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions">
            Versions
            {versions && versions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                {versions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">General</h3>
              <div className="space-y-2.5">
                <Row label="Status">
                  <StatusBadge status={template.status} />
                </Row>
                <Row label="Product Code">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                    {template.productCode}
                  </code>
                </Row>
                <Row label="Description">
                  {template.description || (
                    <span className="text-zinc-300">—</span>
                  )}
                </Row>
                <Row label="Created">
                  {new Date(template.createdAt).toLocaleString()}
                </Row>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">Defaults</h3>
              <div className="space-y-2.5">
                <Row label="Offline Days">{template.defaultOfflineDays} days</Row>
                <Row label="Validity Days">{template.defaultValidityDays} days</Row>
                <Row label="Current Version">
                  {template.currentVersionId ? (
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                      {template.currentVersionId.slice(0, 8)}…
                    </code>
                  ) : (
                    <span className="text-amber-600 text-xs">No version yet</span>
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
              <DialogContent className="sm:max-w-lg">
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
            <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-200 py-14 text-center">
              <p className="text-sm font-medium text-zinc-500">No versions yet</p>
              <p className="mt-1 text-sm text-zinc-400">
                Create a version to define a config schema.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions?.map((v) => (
                <div key={v.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                        v{v.version}
                      </span>
                      {v.changelog && (
                        <span className="text-sm text-zinc-600">{v.changelog}</span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-400">Config Schema</p>
                      <pre className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-xs font-mono overflow-auto max-h-40 text-zinc-600">
                        {formatJson(v.configSchema)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-400">Defaults</p>
                      <pre className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-xs font-mono overflow-auto max-h-40 text-zinc-600">
                        {formatJson(v.defaults)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
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

function CreateVersionForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: CreateTemplateVersionRequest) => void
  isPending: boolean
}) {
  const { register, handleSubmit } = useForm<CreateTemplateVersionRequest>({
    defaultValues: { configSchema: '{}', defaults: '{}' },
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="configSchema">Config Schema (JSON Schema)</Label>
        <Textarea
          id="configSchema"
          {...register('configSchema')}
          rows={6}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="defaults">
          Defaults{' '}
          <span className="text-zinc-400 font-normal text-xs">(UI hints — not pre-filled values)</span>
        </Label>
        <Textarea
          id="defaults"
          {...register('defaults')}
          rows={4}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="changelog">Changelog</Label>
        <Input id="changelog" {...register('changelog')} placeholder="What changed in this version?" />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Version'}
      </Button>
    </form>
  )
}

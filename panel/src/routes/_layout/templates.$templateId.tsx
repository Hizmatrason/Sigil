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
  type Company,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, Edit, Archive, Plus } from 'lucide-react'
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

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await api.get<Company[]>('/panel/companies')
      return data
    },
  })

  const company = companies?.find((c) => c.id === template?.companyId)

  // Update mutation
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

  // Archive mutation
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

  // Create version mutation
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

  if (isLoading || !template) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/templates" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{template.name}</h2>
          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{template.productCode}</code>
            {' · '}
            {company?.name ?? 'Unknown Company'}
          </p>
        </div>
        <div className="flex gap-2">
          {template.status !== 'Archived' && (
            <>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" /> Edit
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
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive template?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will archive &ldquo;{template.name}&rdquo;. Existing licenses remain unaffected.
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
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions">Versions ({versions?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Status">
                  <Badge variant={template.status === 'Active' ? 'default' : 'secondary'}>
                    {template.status}
                  </Badge>
                </DetailRow>
                <DetailRow label="Product Code">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{template.productCode}</code>
                </DetailRow>
                <DetailRow label="Company">{company?.name ?? template.companyId}</DetailRow>
                <DetailRow label="Description">
                  {template.description || <span className="text-muted-foreground">—</span>}
                </DetailRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Offline Days">{template.defaultOfflineDays} days</DetailRow>
                <DetailRow label="Validity Days">{template.defaultValidityDays} days</DetailRow>
                <DetailRow label="Current Version">
                  {template.currentVersionId ? (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {template.currentVersionId.slice(0, 8)}…
                    </code>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </DetailRow>
                <DetailRow label="Created">
                  {new Date(template.createdAt).toLocaleString()}
                </DetailRow>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New Version
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
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No versions yet. Create one to define a config schema.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {versions?.map((v) => (
                <Card key={v.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">v{v.version}</Badge>
                        {v.changelog && <span className="text-sm">{v.changelog}</span>}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Config Schema</p>
                        <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                          {formatJson(v.configSchema)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Defaults</p>
                        <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                          {formatJson(v.defaults)}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
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

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

// ── Edit Form ─────────────────────────────────────────────────────────────

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
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="productCode">Product Code</Label>
        <Input id="productCode" {...register('productCode')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register('description')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="defaultOfflineDays">Offline Days</Label>
          <Input id="defaultOfflineDays" type="number" {...register('defaultOfflineDays', { valueAsNumber: true })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultValidityDays">Validity Days</Label>
          <Input id="defaultValidityDays" type="number" {...register('defaultValidityDays', { valueAsNumber: true })} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}

// ── Create Version Form ───────────────────────────────────────────────────

function CreateVersionForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: CreateTemplateVersionRequest) => void
  isPending: boolean
}) {
  const { register, handleSubmit } = useForm<CreateTemplateVersionRequest>({
    defaultValues: {
      configSchema: '{}',
      defaults: '{}',
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="configSchema">Config Schema (JSON)</Label>
        <Textarea id="configSchema" {...register('configSchema')} rows={6} className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaults">Defaults (JSON)</Label>
        <Textarea id="defaults" {...register('defaults')} rows={6} className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="changelog">Changelog</Label>
        <Input id="changelog" {...register('changelog')} placeholder="What changed in this version?" />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Version'}
      </Button>
    </form>
  )
}

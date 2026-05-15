import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api, type LicenseTemplate, type CreateTemplateRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ArrowRight, FileText, Plus, Search } from 'lucide-react'
import { useState, useMemo } from 'react'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  productCode: z.string().min(1, 'Product code is required'),
  description: z.string().optional(),
  defaultOfflineDays: z.coerce.number().min(0),
  defaultValidityDays: z.coerce.number().min(0),
})

type CreateForm = z.infer<typeof createSchema>

export const Route = createFileRoute('/_layout/templates/')({
  component: TemplatesPage,
})

function TemplatesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get<LicenseTemplate[]>('/panel/templates')
      return data
    },
  })

  const filtered = useMemo(() => {
    if (!templates) return []
    return templates.filter((t) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.productCode.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [templates, search, statusFilter])

  const createMutation = useMutation({
    mutationFn: async (req: CreateTemplateRequest) => {
      const { data } = await api.post<LicenseTemplate>('/panel/templates', req)
      return data
    },
    onSuccess: () => {
      toast.success('Template created')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setOpen(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create template')
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { defaultOfflineDays: 30, defaultValidityDays: 365 },
  })

  const onSubmit = (data: CreateForm) => createMutation.mutate(data)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Global license templates shared across all companies
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) reset()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g. Professional Suite" />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="productCode">Product Code</Label>
                <Input
                  id="productCode"
                  {...register('productCode')}
                  placeholder="e.g. PRO-SUITE"
                  className="font-mono"
                />
                {errors.productCode && (
                  <p className="text-xs text-destructive">{errors.productCode.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">
                  Description{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="description"
                  {...register('description')}
                  placeholder="Short description of this product"
                />
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

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Template'}
              </Button>
            </form>
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
            placeholder="Search by name or product code…"
            className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Product Code
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Offline / Validity
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Created
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-border/50">
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center py-14 text-center">
                    <div className="rounded-full bg-muted p-3.5">
                      <FileText className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {templates?.length === 0 ? 'No templates yet' : 'No results'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {templates?.length === 0
                        ? 'Create a template to define your product\'s license structure.'
                        : 'Try adjusting your search or filter.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((template) => (
                <TableRow key={template.id} className="border-border/50 hover:bg-muted/20">
                  <TableCell>
                    <Link
                      to="/templates/$templateId"
                      params={{ templateId: template.id }}
                      className="font-medium text-foreground hover:text-indigo-400 transition-colors"
                    >
                      {template.name}
                    </Link>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      {template.productCode}
                    </code>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={template.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {template.defaultOfflineDays}d / {template.defaultValidityDays}d
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/templates/$templateId"
                      params={{ templateId: template.id }}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    >
                      View
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

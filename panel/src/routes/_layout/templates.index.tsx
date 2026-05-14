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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/lib/status'
import { FileText, Plus } from 'lucide-react'
import { useState } from 'react'

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

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get<LicenseTemplate[]>('/panel/templates')
      return data
    },
  })

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
          <h1 className="text-xl font-semibold text-zinc-900">Templates</h1>
          <p className="mt-1 text-sm text-zinc-500">
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
                  <span className="text-zinc-400 font-normal">(optional)</span>
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

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-zinc-200">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Name
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product Code
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Status
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Offline / Validity
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Created
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-zinc-100">
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
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
            ) : templates?.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center py-14 text-center">
                    <div className="rounded-full bg-zinc-100 p-3.5">
                      <FileText className="h-6 w-6 text-zinc-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-700">No templates yet</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Create a template to define your product's license structure.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              templates?.map((template) => (
                <TableRow key={template.id} className="border-zinc-100 hover:bg-zinc-50/50">
                  <TableCell>
                    <Link
                      to="/templates/$templateId"
                      params={{ templateId: template.id }}
                      className="font-medium text-zinc-800 hover:text-indigo-600 transition-colors"
                    >
                      {template.name}
                    </Link>
                    {template.description && (
                      <p className="text-xs text-zinc-400 mt-0.5">{template.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-700">
                      {template.productCode}
                    </code>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={template.status} />
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {template.defaultOfflineDays}d / {template.defaultValidityDays}d
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {new Date(template.createdAt).toLocaleDateString()}
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

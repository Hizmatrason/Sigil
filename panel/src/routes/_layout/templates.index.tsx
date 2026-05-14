import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  api,
  type LicenseTemplate,
  type CreateTemplateRequest,
  type Company,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus } from 'lucide-react'
import { useState } from 'react'

const createSchema = z.object({
  companyId: z.string().min(1, 'Company is required'),
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

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await api.get<Company[]>('/panel/companies')
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (req: CreateTemplateRequest) => {
      const { data } = await api.post<LicenseTemplate>('/panel/templates', req)
      return data
    },
    onSuccess: () => {
      toast.success('Template created successfully')
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
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      defaultOfflineDays: 30,
      defaultValidityDays: 365,
    },
  })

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">License Templates</h2>
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
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g. Professional Suite" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productCode">Product Code</Label>
                <Input
                  id="productCode"
                  {...register('productCode')}
                  placeholder="e.g. PRO-SUITE"
                />
                {errors.productCode && (
                  <p className="text-xs text-destructive">{errors.productCode.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" {...register('description')} placeholder="Optional" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultOfflineDays">Offline Days</Label>
                  <Input
                    id="defaultOfflineDays"
                    type="number"
                    {...register('defaultOfflineDays', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultValidityDays">Validity Days</Label>
                  <Input
                    id="defaultValidityDays"
                    type="number"
                    {...register('defaultValidityDays', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </form>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Offline / Validity</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No templates yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
                {templates?.map((template) => {
                  const company = companies?.find((c) => c.id === template.companyId)
                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Link
                          to="/templates/$templateId"
                          params={{ templateId: template.id }}
                          className="font-medium hover:underline"
                        >
                          {template.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {template.productCode}
                        </code>
                      </TableCell>
                      <TableCell>{company?.name ?? template.companyId}</TableCell>
                      <TableCell>
                        <Badge variant={template.status === 'Active' ? 'default' : 'secondary'}>
                          {template.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {template.defaultOfflineDays}d / {template.defaultValidityDays}d
                      </TableCell>
                      <TableCell>{new Date(template.createdAt).toLocaleDateString()}</TableCell>
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

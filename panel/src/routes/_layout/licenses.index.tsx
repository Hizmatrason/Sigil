import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, type License, type IssueLicenseRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus } from 'lucide-react'
import { useState } from 'react'

const issueSchema = z.object({
  companyId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  maxActivations: z.coerce.number().min(1).optional(),
  expiresAt: z.string().optional(),
})

type IssueForm = z.infer<typeof issueSchema>

export const Route = createFileRoute('/_layout/licenses/')({
  component: LicensesPage,
})

function LicensesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: licenses } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const { data } = await api.get<License[]>('/panel/licenses')
      return data
    },
  })

  const issueMutation = useMutation({
    mutationFn: async (req: IssueLicenseRequest) => {
      const { data } = await api.post<License>('/panel/licenses/issue', req)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      setOpen(false)
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
  })

  const onSubmit = (data: IssueForm) => {
    issueMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Licenses</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Issue License
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue License</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyId">Company ID</Label>
                <Input id="companyId" {...register('companyId')} />
                {errors.companyId && <p className="text-xs text-destructive">{errors.companyId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateId">Template ID (optional)</Label>
                <Input id="templateId" {...register('templateId')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxActivations">Max Activations</Label>
                <Input id="maxActivations" type="number" {...register('maxActivations')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires At (optional)</Label>
                <Input id="expiresAt" type="datetime-local" {...register('expiresAt')} />
              </div>
              <Button type="submit" className="w-full" disabled={issueMutation.isPending}>
                {issueMutation.isPending ? 'Issuing...' : 'Issue'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses?.map((license) => (
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
                  <TableCell>{license.companyId}</TableCell>
                  <TableCell>{license.status}</TableCell>
                  <TableCell>{new Date(license.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

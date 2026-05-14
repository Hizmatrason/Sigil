import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api, type Company, type CreateCompanyRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, ChevronRight, ChevronDown, Building2, Trash2 } from 'lucide-react'
import { useState, useMemo } from 'react'

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

type CreateForm = z.infer<typeof createSchema>

export const Route = createFileRoute('/_layout/companies/')({
  component: CompaniesPage,
})

interface TreeNode {
  id: string
  name: string
  slug: string
  parentId?: string
  path: string
  status: string
  createdAt: string
  children: TreeNode[]
}

function buildTree(companies: Company[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const c of companies) {
    map.set(c.id, { ...c, children: [] })
  }

  for (const c of companies) {
    const node = map.get(c.id)!
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function TreeView({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[]
  selectedId?: string
  onSelect: (node: TreeNode) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const isExpanded = expanded.has(node.id)
        const isSelected = selectedId === node.id

        return (
          <div key={node.id}>
            <div
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent ${
                isSelected ? 'bg-accent' : ''
              }`}
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
              onClick={() => onSelect(node)}
            >
              {hasChildren ? (
                <button
                  className="p-0.5 hover:bg-muted rounded"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(node.id)
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{node.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{node.slug}</span>
            </div>
            {hasChildren && isExpanded && (
              <TreeView
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CompaniesPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await api.get<Company[]>('/panel/companies')
      return data ?? []
    },
  })

  const tree = useMemo(() => buildTree(companies ?? []), [companies])

  const createMutation = useMutation({
    mutationFn: async (req: CreateCompanyRequest) => {
      const { data } = await api.post<Company>('/panel/companies', req)
      return data
    },
    onSuccess: () => {
      toast.success('Company created')
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setCreateOpen(false)
    },
    onError: () => toast.error('Failed to create company'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/panel/companies/${id}`)
    },
    onSuccess: () => {
      toast.success('Company archived')
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setDeleteOpen(false)
      setSelected(null)
    },
    onError: () => toast.error('Failed to archive company'),
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({
      ...data,
      parentId: selected?.id,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Companies</h2>
        <Button onClick={() => { reset(); setCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          New Company
        </Button>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-6">
        <div className="rounded-lg border bg-card p-3">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tree</h3>
          {tree.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No companies yet. Create your first one!
            </p>
          ) : (
            <TreeView nodes={tree} selectedId={selected?.id} onSelect={setSelected} />
          )}
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selected.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{selected.path}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: selected.id }}
                    >
                      View Details
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border p-3">
                  <span className="text-muted-foreground">Slug</span>
                  <p className="font-medium">{selected.slug}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">{selected.status}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{new Date(selected.createdAt).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <span className="text-muted-foreground">Children</span>
                  <p className="font-medium">{selected.children.length}</p>
                </div>
              </div>

              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Company</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete <strong>{selected.name}</strong>?
                    This will archive the company and all its data.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selected.id)}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 rounded-lg border border-dashed text-muted-foreground">
              Select a company from the tree to view details
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected ? `Create child of ${selected.name}` : 'Create Company'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" {...register('slug')} />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

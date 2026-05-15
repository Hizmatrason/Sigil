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
import { StatusBadge } from '@/lib/status'
import { Building2, ChevronDown, ChevronRight, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
})

type CreateForm = z.infer<typeof createSchema>

export const Route = createFileRoute('/_layout/companies/')({
  component: CompaniesPage,
})

interface TreeNode extends Company {
  children: TreeNode[]
}

function buildTree(companies: Company[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const c of companies) map.set(c.id, { ...c, children: [] })
  for (const c of companies) {
    const node = map.get(c.id)!
    if (c.parentId && map.has(c.parentId)) map.get(c.parentId)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

function matchesSearch(node: TreeNode, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  if (node.name.toLowerCase().includes(lower) || node.slug.toLowerCase().includes(lower)) return true
  return node.children.some((c) => matchesSearch(c, q))
}

function TreeNodeComponent({
  node,
  selectedId,
  onSelect,
  depth = 0,
  searchQuery,
}: {
  node: TreeNode
  selectedId?: string
  onSelect: (n: TreeNode) => void
  depth?: number
  searchQuery: string
}) {
  const isSearching = !!searchQuery
  const [expanded, setExpanded] = useState(depth === 0 || isSearching)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id
  const isVisible = matchesSearch(node, searchQuery)

  useEffect(() => {
    if (isSearching) setExpanded(true)
  }, [isSearching])

  if (!isVisible) return null

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-500/15 text-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-400'
            : 'hover:bg-muted text-foreground/80'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-muted/80 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Building2
          className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-muted-foreground/60'}`}
        />
        <span className="text-sm font-medium truncate">{node.name}</span>
        <code className="ml-auto text-[11px] text-muted-foreground/60 bg-muted rounded px-1.5 shrink-0">
          {node.slug}
        </code>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CompaniesPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: companies, isLoading } = useQuery({
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
      toast.success('Company deleted')
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setSelected(null)
    },
    onError: () => toast.error('Failed to delete company'),
  })

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const nameValue = watch('name')
  useEffect(() => {
    if (nameValue) {
      const autoSlug = nameValue
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setValue('slug', autoSlug, { shouldValidate: false })
    }
  }, [nameValue, setValue])

  const onSubmit = (data: CreateForm) => {
    createMutation.mutate({ ...data, parentId: selected?.id })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Companies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your tenant hierarchy
          </p>
        </div>
        <Button onClick={() => { reset(); setSelected(null); setCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          New Company
        </Button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-5">
        {/* Tree panel */}
        <div className="rounded-xl border border-border bg-card p-3 h-fit">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Hierarchy
          </p>
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies…"
              className="w-full rounded-lg border border-border bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {isLoading ? (
            <div className="space-y-1.5 px-2">
              {[40, 32, 48, 28].map((w, i) => (
                <div key={i} className="h-7 animate-pulse rounded-md bg-muted" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No companies yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <TreeNodeComponent
                  key={node.id}
                  node={node}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="space-y-4">
            {/* Selected header */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <code className="mt-1 text-xs text-muted-foreground">{selected.path}</code>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/companies/$companyId" params={{ companyId: selected.id }}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Details
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { reset(); setCreateOpen(true) }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add child
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete company?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete{' '}
                          <strong>{selected.name}</strong> and all associated data.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(selected.id)}
                          className="bg-destructive text-destructive-foreground"
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Info grid */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <InfoCell label="Slug" value={<code className="font-mono">{selected.slug}</code>} />
                <InfoCell
                  label="Created"
                  value={new Date(selected.createdAt).toLocaleDateString()}
                />
                <InfoCell
                  label="Children"
                  value={selected.children.length.toString()}
                />
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Quick links
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/licenses" search={{ companyId: selected.id } as Record<string, string>}>
                    <Building2 className="mr-1.5 h-3.5 w-3.5" />
                    Licenses for {selected.name}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Select a company from the tree to view details
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected ? `Create child of "${selected.name}"` : 'Create Company'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} placeholder="Acme Corp" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">
                Slug{' '}
                <span className="text-muted-foreground font-normal text-xs">(auto-filled from name)</span>
              </Label>
              <Input id="slug" {...register('slug')} placeholder="acme-corp" className="font-mono" />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <p className="text-xs text-muted-foreground/60">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground/80">{value}</p>
    </div>
  )
}

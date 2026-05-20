import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useState } from 'react'
import {
  webhooksApi,
  type WebhookEndpoint,
  type WebhookDelivery,
} from '@/lib/api'
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
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_layout/settings/webhooks')({
  component: WebhooksPage,
})

// ── Schemas ───────────────────────────────────────────────────────────────

const endpointSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  secret: z.string().min(8, 'At least 8 characters'),
  description: z.string(),
  events: z.string().min(1, 'Select at least one event'),
})

type EndpointForm = z.infer<typeof endpointSchema>

// ── Main page ─────────────────────────────────────────────────────────────

function WebhooksPage() {
  const { data: endpoints, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => webhooksApi.listEndpoints().then((r) => r.data),
  })

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['webhook-event-types'],
    queryFn: () => webhooksApi.eventTypes().then((r) => r.data),
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receive HTTP POST notifications for license events
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New webhook endpoint</DialogTitle>
            </DialogHeader>
            <EndpointForm
              eventTypes={eventTypes}
              onSuccess={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : endpoints?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No webhook endpoints yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints?.map((ep) => (
            <EndpointCard
              key={ep.id}
              endpoint={ep}
              eventTypes={eventTypes}
              expanded={expandedId === ep.id}
              onToggleExpand={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
            />
          ))}
        </div>
      )}

      <EventPayloadReference />
    </div>
  )
}

// ── EndpointCard ──────────────────────────────────────────────────────────

function EndpointCard({
  endpoint,
  eventTypes,
  expanded,
  onToggleExpand,
}: {
  endpoint: WebhookEndpoint
  eventTypes: string[]
  expanded: boolean
  onToggleExpand: () => void
}) {
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const toggleMutation = useMutation({
    mutationFn: () =>
      webhooksApi.updateEndpoint(endpoint.id, { isActive: !endpoint.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(endpoint.isActive ? 'Endpoint disabled' : 'Endpoint enabled')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => webhooksApi.deleteEndpoint(endpoint.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Endpoint deleted')
    },
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{endpoint.url}</p>
          {endpoint.description && (
            <p className="truncate text-xs text-muted-foreground">{endpoint.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {endpoint.events.map((e) => (
            <span
              key={e}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
            >
              {e}
            </span>
          ))}
        </div>

        <StatusBadge status={endpoint.isActive ? 'Active' : 'Revoked'} />

        {/* Actions */}
        <button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          title={endpoint.isActive ? 'Disable' : 'Enable'}
        >
          {endpoint.isActive ? (
            <ToggleRight className="h-4 w-4 text-emerald-500" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
        </button>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit endpoint</DialogTitle>
            </DialogHeader>
            <EndpointForm
              endpoint={endpoint}
              eventTypes={eventTypes}
              onSuccess={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <button
          onClick={() => {
            if (confirm('Delete this webhook endpoint?')) deleteMutation.mutate()
          }}
          disabled={deleteMutation.isPending}
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Deliveries panel */}
      {expanded && <DeliveriesPanel endpointId={endpoint.id} />}
    </div>
  )
}

// ── EndpointForm ──────────────────────────────────────────────────────────

function EndpointForm({
  endpoint,
  eventTypes,
  onSuccess,
}: {
  endpoint?: WebhookEndpoint
  eventTypes: string[]
  onSuccess: () => void
}) {
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EndpointForm>({
    resolver: zodResolver(endpointSchema),
    defaultValues: {
      url: endpoint?.url ?? '',
      secret: '',
      description: endpoint?.description ?? '',
      events: endpoint?.events.join(',') ?? '',
    },
  })

  const createMut = useMutation({
    mutationFn: (data: EndpointForm) =>
      webhooksApi.createEndpoint({
        url: data.url,
        secret: data.secret,
        description: data.description,
        events: data.events.split(',').map((e) => e.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Endpoint created')
      onSuccess()
    },
    onError: () => toast.error('Failed to create endpoint'),
  })

  const updateMut = useMutation({
    mutationFn: (data: EndpointForm) =>
      webhooksApi.updateEndpoint(endpoint!.id, {
        url: data.url,
        secret: data.secret || undefined,
        description: data.description,
        events: data.events.split(',').map((e) => e.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Endpoint updated')
      onSuccess()
    },
    onError: () => toast.error('Failed to update endpoint'),
  })

  const onSubmit = (data: EndpointForm) => {
    if (endpoint) updateMut.mutate(data)
    else createMut.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="url">URL</Label>
        <Input id="url" placeholder="https://your-server.example/webhook" {...register('url')} />
        {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="secret">
          Secret{' '}
          {endpoint && (
            <span className="text-xs text-muted-foreground font-normal">(leave blank to keep current)</span>
          )}
        </Label>
        <Input id="secret" type="password" placeholder="min 8 characters" {...register('secret')} />
        {errors.secret && <p className="text-xs text-destructive">{errors.secret.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" placeholder="Optional note" {...register('description')} />
      </div>

      <div className="space-y-1.5">
        <Label>Events</Label>
        <Controller
          name="events"
          control={control}
          render={({ field }) => {
            const selected = field.value
              ? field.value.split(',').map((e) => e.trim()).filter(Boolean)
              : []

            const toggle = (ev: string) => {
              const next = selected.includes(ev)
                ? selected.filter((e) => e !== ev)
                : [...selected, ev]
              field.onChange(next.join(','))
            }

            return (
              <div className="flex flex-wrap gap-1.5">
                {eventTypes.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggle(ev)}
                    className={cn(
                      'rounded px-2 py-1 text-xs font-mono transition-colors',
                      selected.includes(ev)
                        ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            )
          }}
        />
        {errors.events && <p className="text-xs text-destructive">{errors.events.message}</p>}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {endpoint ? 'Save changes' : 'Create endpoint'}
        </Button>
      </div>
    </form>
  )
}

// ── DeliveriesPanel ───────────────────────────────────────────────────────

function DeliveriesPanel({ endpointId }: { endpointId: string }) {
  const qc = useQueryClient()
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', endpointId],
    queryFn: () => webhooksApi.getDeliveries(endpointId).then((r) => r.data),
  })

  const replayMut = useMutation({
    mutationFn: (id: string) => webhooksApi.replay(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhook-deliveries', endpointId] })
      toast.success('Delivery queued for replay')
    },
    onError: () => toast.error('Replay failed'),
  })

  return (
    <div className="border-t border-border">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Recent deliveries
        </span>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['webhook-deliveries', endpointId] })}
          className="text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 pb-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      ) : deliveries?.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground">No deliveries yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-32">Event</TableHead>
              <TableHead className="text-xs w-24">Status</TableHead>
              <TableHead className="text-xs w-20">Attempts</TableHead>
              <TableHead className="text-xs w-28">HTTP</TableHead>
              <TableHead className="text-xs">Error</TableHead>
              <TableHead className="text-xs w-36">Created</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries?.map((d) => (
              <DeliveryRow key={d.id} delivery={d} onReplay={() => replayMut.mutate(d.id)} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function DeliveryRow({
  delivery,
  onReplay,
}: {
  delivery: WebhookDelivery
  onReplay: () => void
}) {
  const [showPayload, setShowPayload] = useState(false)

  const statusColor =
    delivery.status === 'Success'
      ? 'text-emerald-400'
      : delivery.status === 'Failed'
        ? 'text-red-400'
        : 'text-yellow-400'

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={() => setShowPayload((p) => !p)}
      >
        <TableCell className="text-xs font-mono">{delivery.eventType}</TableCell>
        <TableCell>
          <span className={cn('text-xs font-medium', statusColor)}>{delivery.status}</span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{delivery.attemptCount}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {delivery.responseStatusCode ?? '—'}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
          {delivery.lastError ?? '—'}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {new Date(delivery.createdAt).toLocaleString()}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onReplay()
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Replay
          </Button>
        </TableCell>
      </TableRow>
      {showPayload && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20 p-0">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 text-[11px] text-muted-foreground font-mono">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(delivery.payload), null, 2)
                } catch {
                  return delivery.payload
                }
              })()}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ── Payload reference ─────────────────────────────────────────────────────

function EventPayloadReference() {
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-foreground select-none">
        Payload format & HMAC verification
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 text-sm">
        <div>
          <p className="text-muted-foreground mb-2">
            Every delivery sends a JSON envelope with the following shape:
          </p>
          <pre className="rounded-lg bg-muted p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
{`{
  "event": "license.issued",
  "occurredAt": "2026-05-20T14:00:00Z",
  "data": { /* event-specific fields */ }
}`}
          </pre>
        </div>

        <div>
          <p className="font-medium text-foreground mb-1">Verifying the signature</p>
          <p className="text-muted-foreground mb-2">
            Each request includes <code className="text-xs bg-muted px-1 rounded">X-Sigil-Signature: sha256=&lt;hex&gt;</code>.
            Compute <code className="text-xs bg-muted px-1 rounded">HMAC-SHA256(key=secret, message=raw_body_bytes)</code> and compare.
          </p>
          <pre className="rounded-lg bg-muted p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
{`// Node.js
import { createHmac } from 'node:crypto'
const sig = createHmac('sha256', secret).update(rawBody).digest('hex')
if (sig !== req.headers['x-sigil-signature'].slice(7)) throw new Error('invalid')

# Python
import hmac, hashlib
sig = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
assert sig == request.headers['X-Sigil-Signature'][7:]`}
          </pre>
        </div>

        <div>
          <p className="font-medium text-foreground mb-1">Event types</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              ['license.issued', 'New license created'],
              ['license.revoked', 'License manually revoked'],
              ['license.expired', 'License passed expiry date'],
              ['license.activated', 'SDK activated license on a machine'],
              ['license.heartbeat_missed', 'No heartbeat within expected window'],
            ].map(([ev, desc]) => (
              <div key={ev} className="flex items-start gap-2 py-0.5">
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground shrink-0">
                  {ev}
                </code>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, type AuditLogEntry } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_layout/audit')({
  component: AuditPage,
})

const ACTION_COLORS: Record<string, string> = {
  'license.issued': 'text-emerald-400',
  'license.revoked': 'text-red-400',
  'template.created': 'text-sky-400',
  'template.archived': 'text-zinc-400',
  'signing_key.rotated': 'text-yellow-400',
  'signing_key.retired': 'text-zinc-400',
}

const ALL_ACTIONS = [
  'license.issued',
  'license.revoked',
  'template.created',
  'template.archived',
  'signing_key.rotated',
  'signing_key.retired',
]

function AuditPage() {
  const [action, setAction] = useState<string>('')
  const [actorEmail, setActorEmail] = useState('')
  const [entityType, setEntityType] = useState<string>('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit', action, actorEmail, entityType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' })
      if (action) params.set('action', action)
      if (actorEmail) params.set('actorEmail', actorEmail)
      if (entityType) params.set('entityType', entityType)
      const { data } = await api.get<AuditLogEntry[]>(`/panel/audit?${params}`)
      return data
    },
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable record of all significant actions in the system
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All actions</SelectItem>
            {ALL_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All entities</SelectItem>
            {['License', 'Template', 'Company', 'SigningKey'].map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by actor email…"
          value={actorEmail}
          onChange={(e) => setActorEmail(e.target.value)}
          className="w-64"
        />

        {(action || entityType || actorEmail) && (
          <button
            onClick={() => {
              setAction('')
              setEntityType('')
              setActorEmail('')
            }}
            className="px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No audit events match the current filters.</p>
        </div>
      ) : (
        <div className={cn('space-y-px rounded-xl overflow-hidden border border-border', isFetching && 'opacity-60')}>
          {data?.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const color = ACTION_COLORS[entry.action] ?? 'text-muted-foreground'

  return (
    <>
      <div
        className="flex items-center gap-4 bg-card px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="w-36 shrink-0 text-xs text-muted-foreground/60 font-mono tabular-nums">
          {new Date(entry.occurredAt).toLocaleString()}
        </span>
        <span className={cn('w-44 shrink-0 text-xs font-mono font-medium', color)}>
          {entry.action}
        </span>
        <span className="w-28 shrink-0 text-xs text-muted-foreground">{entry.entityType}</span>
        <span className="min-w-0 flex-1 text-xs text-muted-foreground truncate font-mono">
          {entry.entityId ?? '—'}
        </span>
        <span className="w-48 shrink-0 text-xs text-muted-foreground truncate text-right">
          {entry.actorEmail ?? <span className="text-muted-foreground/40">system</span>}
        </span>
      </div>
      {expanded && (
        <div className="bg-muted/20 border-t border-border px-4 py-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            {entry.ipAddress && (
              <div>
                <p className="text-muted-foreground/60 mb-0.5">IP Address</p>
                <code className="font-mono text-muted-foreground">{entry.ipAddress}</code>
              </div>
            )}
            {entry.meta && (
              <div className="col-span-2">
                <p className="text-muted-foreground/60 mb-0.5">Metadata</p>
                <pre className="font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(entry.meta), null, 2)
                    } catch {
                      return entry.meta
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

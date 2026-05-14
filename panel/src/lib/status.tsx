export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    Revoked: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
    Expired: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/20',
    Draft: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
    Archived: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
    Suspended: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  }
  const style = cls[status] ?? 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/20'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}

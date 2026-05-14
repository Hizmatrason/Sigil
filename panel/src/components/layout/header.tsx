import { useAuth } from '@/hooks/use-auth'

export function Header() {
  const { user } = useAuth()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-lg font-semibold">Sigil Panel</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
      </div>
    </header>
  )
}

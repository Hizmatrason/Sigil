import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/hooks/use-auth'
import { StatusBadge } from '@/lib/status'

export const Route = createFileRoute('/_layout/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Account and system information</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Account */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Account</h2>
          <div className="space-y-2.5">
            <Row label="Email">
              <span className="font-mono text-sm">{user?.email}</span>
            </Row>
            <Row label="Display Name">
              {user?.displayName ?? <span className="text-zinc-300">—</span>}
            </Row>
            <Row label="Role">
              <StatusBadge status={user?.isOperator ? 'Active' : 'Draft'} />
              <span className="ml-2 text-sm">{user?.isOperator ? 'Operator' : 'User'}</span>
            </Row>
          </div>
        </div>

        {/* System */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">System</h2>
          <div className="space-y-2.5">
            <Row label="Version">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-600">
                Phase 2
              </span>
            </Row>
            <Row label="API">
              <code className="text-xs text-zinc-500">/api/v1</code>
            </Row>
            <Row label="Auth">
              <span className="text-sm text-zinc-600">Cookie-based session (7d sliding)</span>
            </Row>
            <Row label="Signing">
              <span className="text-sm text-zinc-600">Ed25519 (EncryptedFileSigner)</span>
            </Row>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="shrink-0 text-zinc-400">{label}</span>
      <span className="text-right text-zinc-700 flex items-center">{children}</span>
    </div>
  )
}

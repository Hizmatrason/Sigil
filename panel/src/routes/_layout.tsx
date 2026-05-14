import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Sidebar } from '@/components/layout/sidebar'

export const Route = createFileRoute('/_layout')({
  component: LayoutComponent,
  beforeLoad: async ({ context }) => {
    const { queryClient } = context
    try {
      const user = await queryClient.fetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
          const { api } = await import('@/lib/api')
          const { data } = await api.get('/panel/auth/me')
          return data
        },
      })
      if (!user) throw redirect({ to: '/login' })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
})

function LayoutComponent() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-zinc-50">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

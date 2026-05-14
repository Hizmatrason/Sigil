import { createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Fingerprint } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export const Route = createFileRoute('/login')({
  component: LoginPage,
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
      if (user) throw redirect({ to: '/' })
    } catch {
      // not authenticated, stay on login
    }
  },
})

const features = [
  'Ed25519-signed license tokens',
  '30-day offline grace period',
  'Multi-tenant company hierarchy',
]

function LoginPage() {
  const { login, loginLoading } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      setAuthError(null)
      await login(data)
      window.location.href = '/'
    } catch {
      setAuthError('Invalid email or password')
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[400px] shrink-0 flex-col bg-zinc-950 p-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 ring-1 ring-indigo-500/30">
            <Fingerprint className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="text-base font-semibold text-white">Sigil</span>
        </div>

        <div className="my-auto">
          <h1 className="text-[2rem] font-semibold leading-tight text-white">
            License management<br />
            for serious software.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 max-w-xs">
            Cryptographically signed licenses with offline support, company hierarchies,
            and a clean web panel for your team.
          </p>

          <div className="mt-8 space-y-3">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-zinc-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-700">Self-hosted · Ed25519 · Open source</p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50">
            <Fingerprint className="h-4 w-4 text-indigo-600" />
          </div>
          <span className="text-base font-semibold text-zinc-900">Sigil</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-zinc-900">Sign in</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Enter your credentials to access the panel
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-700 text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                className="h-10"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-zinc-700 text-sm">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-10"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {authError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {authError}
              </div>
            )}

            <Button type="submit" className="h-10 w-full" disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

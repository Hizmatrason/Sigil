import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FileText, KeyRound, Users } from 'lucide-react'

export const Route = createFileRoute('/_layout/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const [companies, templates, licenses] = await Promise.all([
        api.get('/panel/companies').then(r => r.data),
        api.get('/panel/templates').then(r => r.data),
        api.get('/panel/licenses').then(r => r.data),
      ])
      return {
        companies: companies?.length ?? 0,
        templates: templates?.length ?? 0,
        licenses: licenses?.length ?? 0,
      }
    },
  })

  const items = [
    { title: 'Companies', value: stats?.companies ?? 0, icon: Building2 },
    { title: 'Templates', value: stats?.templates ?? 0, icon: FileText },
    { title: 'Licenses', value: stats?.licenses ?? 0, icon: KeyRound },
    { title: 'Users', value: 0, icon: Users },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

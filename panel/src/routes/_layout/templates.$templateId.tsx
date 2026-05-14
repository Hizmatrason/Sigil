import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api, type LicenseTemplate, type TemplateVersion } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_layout/templates/$templateId')({
  component: TemplateDetailPage,
})

function TemplateDetailPage() {
  const { templateId } = Route.useParams()

  const { data: template } = useQuery({
    queryKey: ['templates', templateId],
    queryFn: async () => {
      const { data } = await api.get<LicenseTemplate>(`/panel/templates/${templateId}`)
      return data
    },
  })

  const { data: versions } = useQuery({
    queryKey: ['templates', templateId, 'versions'],
    queryFn: async () => {
      const { data } = await api.get<TemplateVersion[]>(`/panel/templates/${templateId}/versions`)
      return data
    },
  })

  if (!template) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{template.name}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Company ID</span>
              <span className="font-mono">{template.companyId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span>{template.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Description</span>
              <span>{template.description || '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {versions?.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded border p-3">
                <span className="font-medium">Version {v.version}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

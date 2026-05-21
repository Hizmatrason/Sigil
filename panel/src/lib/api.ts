import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  displayName: string | null
  isOperator: boolean
}

// ── Companies ─────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  slug: string
  parentId?: string
  path: string
  depth: number
  status: string
  contactEmail?: string
  createdAt: string
}

export interface CreateCompanyRequest {
  name: string
  slug: string
  parentId?: string
  contactEmail?: string
}

// ── Templates ─────────────────────────────────────────────────────────────

export interface LicenseTemplate {
  id: string
  name: string
  productCode: string
  description?: string
  defaultOfflineDays: number
  defaultValidityDays: number
  status: string
  currentVersionId?: string
  createdAt: string
}

export interface TemplateVersion {
  id: string
  templateId: string
  version: number
  configSchema: string
  defaults: string
  signingKeyId: string
  changelog?: string
  createdAt: string
}

export interface CreateTemplateRequest {
  name: string
  productCode: string
  description?: string
  defaultOfflineDays: number
  defaultValidityDays: number
}

export interface UpdateTemplateRequest {
  name?: string
  productCode?: string
  description?: string
  defaultOfflineDays?: number
  defaultValidityDays?: number
}

export interface CreateTemplateVersionRequest {
  configSchema: string
  defaults?: string
  changelog?: string
}

export interface SigningKey {
  id: string
  status: string
  notBefore: string
  notAfter?: string
  createdAt: string
  publicKeyHex: string
}

// ── Licenses ──────────────────────────────────────────────────────────────

export interface License {
  id: string
  licenseKey: string
  companyId: string
  templateId: string
  status: string
  config: string
  expiresAt?: string
  issuedAt: string
  activatedAt?: string
  lastHeartbeatAt?: string
}

export interface LicenseTokenResponse {
  licenseKey: string
  token: string
  publicKey: string
}

export interface IssueLicenseRequest {
  companyId: string
  templateId: string
  config: string
  expiresAt?: string
  offlineDays?: number
  hwFingerprint?: string
}

export interface RevokeLicenseRequest {
  reason?: string
}

// ── Activations & Heartbeats ──────────────────────────────────────────────

export interface Activation {
  id: string
  hwFingerprint?: string
  machineName?: string
  status: string
  activatedAt: string
  lastHeartbeatAt?: string
  deactivatedAt?: string
}

export interface HeartbeatEntry {
  id: string
  activationId: string
  occurredAt: string
}

// ── Audit Log ─────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  action: string
  actorEmail?: string
  entityType: string
  entityId?: string
  meta?: string
  ipAddress?: string
  occurredAt: string
}

// ── Webhooks ───────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string
  url: string
  description: string
  isActive: boolean
  events: string[]
  lastDeliveryAt?: string
  createdAt: string
}

export interface CreateWebhookEndpointRequest {
  url: string
  secret: string
  description: string
  events: string[]
}

export interface UpdateWebhookEndpointRequest {
  url?: string
  secret?: string
  description?: string
  isActive?: boolean
  events?: string[]
}

export interface WebhookDelivery {
  id: string
  endpointId: string
  eventType: string
  payload: string
  status: string
  attemptCount: number
  responseStatusCode?: number
  responseBody?: string
  lastError?: string
  nextAttemptAt?: string
  lastAttemptAt?: string
  createdAt: string
}

export const webhooksApi = {
  listEndpoints: () => api.get<WebhookEndpoint[]>('/panel/webhooks'),
  getEndpoint: (id: string) => api.get<WebhookEndpoint>(`/panel/webhooks/${id}`),
  createEndpoint: (req: CreateWebhookEndpointRequest) => api.post<WebhookEndpoint>('/panel/webhooks', req),
  updateEndpoint: (id: string, req: UpdateWebhookEndpointRequest) =>
    api.patch<WebhookEndpoint>(`/panel/webhooks/${id}`, req),
  deleteEndpoint: (id: string) => api.delete(`/panel/webhooks/${id}`),
  getDeliveries: (id: string, limit = 50) =>
    api.get<WebhookDelivery[]>(`/panel/webhooks/${id}/deliveries?limit=${limit}`),
  replay: (deliveryId: string) => api.post(`/panel/webhooks/deliveries/${deliveryId}/replay`),
  eventTypes: () => api.get<string[]>('/panel/webhooks/event-types'),
}

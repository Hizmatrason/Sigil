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
  defaults: string
  changelog?: string
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

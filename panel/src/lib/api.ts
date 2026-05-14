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
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export interface Company {
  id: string
  name: string
  slug: string
  parentId?: string
  path: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface LicenseTemplate {
  id: string
  companyId: string
  name: string
  description?: string
  status: string
  currentVersionId?: string
  createdAt: string
  updatedAt: string
}

export interface TemplateVersion {
  id: string
  templateId: string
  version: number
  maxActivations?: number
  expiresDays?: number
  features: Record<string, unknown>
  limits: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
}

export interface License {
  id: string
  companyId: string
  templateId?: string
  versionId?: string
  licenseKey: string
  status: string
  maxActivations?: number
  expiresAt?: string
  features: Record<string, unknown>
  limits: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface LicenseVersion {
  id: string
  licenseId: string
  version: number
  token: string
  issuedAt: string
}

export interface CreateCompanyRequest {
  name: string
  slug: string
  parentId?: string
}

export interface CreateTemplateRequest {
  companyId: string
  name: string
  description?: string
  features?: Record<string, unknown>
  limits?: Record<string, unknown>
  metadata?: Record<string, unknown>
  maxActivations?: number
  expiresDays?: number
}

export interface IssueLicenseRequest {
  companyId: string
  templateId?: string
  maxActivations?: number
  expiresAt?: string
  features?: Record<string, unknown>
  limits?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

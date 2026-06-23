import type { AttributeDraft, AttributeType } from '../lib/onboardingTemplates'
import { leerTokenDevPortal } from '../context/DevAuthContext'

export type DevRequestStatus = 'draft' | 'pending' | 'provisioning' | 'active' | 'rejected'

export type DevRequestUser = {
  id?: string
  username: string
  nombreCompleto: string
  rol: 'admin' | 'integrador' | 'lectura'
}

export type DevIntegrationConfig = {
  entityName: string
  businessIdField: string
  entityType: string
  schemaVersion: string
  attributes: Array<{ key: string; label: string; type: string; required: boolean }>
  payloadExample: string
  stack: 'laravel' | 'nodejs' | 'curl'
}

export type DevTenantRequest = {
  id: string
  status: DevRequestStatus
  tenantId: string
  orgName: string
  domain: string
  contactEmail: string
  integration: DevIntegrationConfig
  rejectReason?: string
  users: DevRequestUser[]
  createdAt: string
  updatedAt: string
}

export type DevCredentials = {
  middlewareUrl: string
  tenantId: string
  keys: Record<string, string>
  userPasswords?: Record<string, string>
}

const BFF_PREFIX = '/api'

async function devFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = leerTokenDevPortal()
  const res = await fetch(`${BFF_PREFIX}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.mensaje ?? `HTTP ${res.status}`)
  }
  return data as T
}

export function slugFromOrgName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function attributesToDraft(
  attrs: DevIntegrationConfig['attributes'],
): AttributeDraft[] {
  return attrs.map((a) => ({
    id: crypto.randomUUID(),
    name: a.key || a.label,
    type: (a.type as AttributeType) || 'texto',
    example: '',
  }))
}

export function draftToIntegrationAttributes(attrs: AttributeDraft[]) {
  return attrs
    .filter((a) => a.name.trim())
    .map((a) => ({
      key: a.name.trim(),
      label: a.name.trim(),
      type: a.type,
      required: false,
    }))
}

export async function upsertDevSolicitud(body: {
  id?: string
  tenantId: string
  orgName: string
  domain: string
  contactEmail: string
  integration: DevIntegrationConfig
  users: DevRequestUser[]
  submit: boolean
}): Promise<DevTenantRequest> {
  const res = await devFetch<{ ok: boolean; solicitud: DevTenantRequest }>('/dev/solicitudes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res.solicitud
}

export async function getDevSolicitud(id: string): Promise<DevTenantRequest> {
  const res = await devFetch<{ ok: boolean; solicitud: DevTenantRequest }>(`/dev/solicitudes/${id}`)
  return res.solicitud
}

export async function getDevCredenciales(id: string, email?: string): Promise<DevCredentials> {
  const q = email ? `?email=${encodeURIComponent(email)}` : ''
  const res = await devFetch<{ ok: boolean; credenciales: DevCredentials }>(
    `/dev/solicitudes/${id}/credenciales${q}`,
  )
  return res.credenciales
}

export async function listMisSolicitudes(): Promise<DevTenantRequest[]> {
  const res = await devFetch<{ ok: boolean; solicitudes?: DevTenantRequest[] | null }>('/dev/mis-solicitudes')
  return Array.isArray(res.solicitudes) ? res.solicitudes : []
}

export type DevChatDraft = {
  ready?: boolean
  orgName?: string
  tenantId?: string
  domain?: string
  contactEmail?: string
  users?: DevRequestUser[]
  integration?: DevIntegrationConfig
}

export type DevChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export async function getDevChatStatus(): Promise<{ configured: boolean; model: string }> {
  const res = await devFetch<{ ok: boolean; configured: boolean; model: string }>('/dev/chat/status')
  return { configured: res.configured, model: res.model }
}

export function draftCanSubmit(draft: DevChatDraft | null): boolean {
  if (!draft) return false
  const slug = (draft.tenantId ?? '').trim().toLowerCase()
  const slugOk = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) && slug.length >= 2
  const hasUser = (draft.users ?? []).some((u) => u.username?.trim())
  return !!(
    draft.orgName?.trim() &&
    slugOk &&
    draft.contactEmail?.trim() &&
    hasUser
  )
}

export async function sendDevChat(
  messages: DevChatMessage[],
  draft?: DevChatDraft | null,
): Promise<{ reply: string; draft: DevChatDraft | null; ready: boolean; complete: boolean }> {
  const res = await devFetch<{
    ok: boolean
    reply: string
    draft: DevChatDraft | null
    ready: boolean
    complete?: boolean
  }>('/dev/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, draft: draft ?? null }),
  })
  return {
    reply: res.reply,
    draft: res.draft,
    ready: res.ready,
    complete: res.complete ?? draftCanSubmit(res.draft),
  }
}

export function draftToSolicitudBody(draft: DevChatDraft) {
  return {
    tenantId: draft.tenantId ?? '',
    orgName: draft.orgName ?? '',
    domain: draft.domain ?? '',
    contactEmail: draft.contactEmail ?? '',
    users: draft.users ?? [],
    integration: draft.integration ?? {
      entityName: '',
      businessIdField: 'id',
      entityType: 'registro',
      schemaVersion: 'v1',
      attributes: [],
      payloadExample: '{}',
      stack: 'laravel' as const,
    },
    submit: true,
  }
}

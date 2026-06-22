import type { DevRequestStatus, DevTenantRequest } from './devPortalApi'

const BFF_PREFIX = '/api'
const TOKEN_KEY = 'platform_admin_token'

export function leerTokenPlataforma(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function guardarTokenPlataforma(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = leerTokenPlataforma()
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

export async function loginPlataforma(username: string, password: string): Promise<string> {
  const res = await platformFetch<{ ok: boolean; token: string }>('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  guardarTokenPlataforma(res.token)
  return res.token
}

export async function listarSolicitudesPlataforma(status?: DevRequestStatus): Promise<DevTenantRequest[]> {
  const q = status ? `?status=${status}` : ''
  const res = await platformFetch<{ ok: boolean; solicitudes: DevTenantRequest[] }>(
    `/platform/solicitudes${q}`,
  )
  return res.solicitudes
}

export async function getSolicitudPlataforma(id: string): Promise<DevTenantRequest> {
  const res = await platformFetch<{ ok: boolean; solicitud: DevTenantRequest }>(`/platform/solicitudes/${id}`)
  return res.solicitud
}

export type ActivateResult = {
  tenantId: string
  middlewareUrl: string
  apiKeys: Record<string, string>
  userPasswords: Record<string, string>
}

export async function marcarProvisioning(id: string): Promise<DevTenantRequest> {
  const res = await platformFetch<{ ok: boolean; solicitud: DevTenantRequest }>(
    `/platform/solicitudes/${id}/marcar-provisioning`,
    { method: 'POST' },
  )
  return res.solicitud
}

export async function activarSolicitud(id: string): Promise<ActivateResult> {
  const res = await platformFetch<{ ok: boolean; resultado: ActivateResult }>(
    `/platform/solicitudes/${id}/activar`,
    { method: 'POST' },
  )
  return res.resultado
}

export async function rechazarSolicitud(id: string, motivo: string): Promise<DevTenantRequest> {
  const res = await platformFetch<{ ok: boolean; solicitud: DevTenantRequest }>(
    `/platform/solicitudes/${id}/rechazar`,
    { method: 'POST', body: JSON.stringify({ motivo }) },
  )
  return res.solicitud
}

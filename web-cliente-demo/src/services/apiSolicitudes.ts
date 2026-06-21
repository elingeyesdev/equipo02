import { apiJson } from './apiClient'

// Modelo de una solicitud de cambio del flujo de aprobación (ver
// api-middleware/internal/aprobaciones). El integrador propone; el admin
// aprueba (se escribe en la cadena) o rechaza.

export type OperacionSolicitud = 'crear' | 'actualizar' | 'eliminar' | 'restaurar'
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada'

export interface Solicitud {
  id: string
  tenant: string
  operacion: OperacionSolicitud
  datoId: string
  tipoDato?: string
  payload?: unknown
  txIdOrigen?: string
  solicitante: string
  solicitanteNombre?: string
  estado: EstadoSolicitud
  creadaEn: string
  resueltaEn?: string
  resueltaPor?: string
  motivo?: string
  txIdResultado?: string
}

interface ListaSolicitudesResp {
  ok: boolean
  solicitudes: Solicitud[] | null
}

export async function listarSolicitudes(estado?: EstadoSolicitud): Promise<Solicitud[]> {
  const q = estado ? `?estado=${encodeURIComponent(estado)}` : ''
  const r = await apiJson<ListaSolicitudesResp>(`/solicitudes${q}`, { method: 'GET' })
  return r.solicitudes ?? []
}

export async function aprobarSolicitud(id: string): Promise<{ ok: boolean; txId?: string; mensaje?: string }> {
  return apiJson(`/solicitudes/${encodeURIComponent(id)}/aprobar`, { method: 'POST', body: JSON.stringify({}) })
}

export async function rechazarSolicitud(id: string, motivo?: string): Promise<{ ok: boolean; mensaje?: string }> {
  return apiJson(`/solicitudes/${encodeURIComponent(id)}/rechazar`, {
    method: 'POST',
    body: JSON.stringify({ motivo: (motivo ?? '').trim() }),
  })
}

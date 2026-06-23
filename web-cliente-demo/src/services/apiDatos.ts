import { apiJson } from './apiClient'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import type { ClienteApi, RespuestaLectura } from '../types/api'

/** Activo genérico del modelo universal (dato_cc). */
export interface DatoGenerico {
  datoId: string
  tipo: string
  payload: unknown
}

/**
 * Respuesta de una mutación que PUEDE quedar pendiente de aprobación.
 * Si el actor es integrador, el backend responde 202 con estado "pendiente"
 * y un solicitudId; si es admin, responde con txId confirmado.
 */
export interface RespuestaMutacionDato {
  ok: boolean
  estado?: 'pendiente'
  solicitudId?: string
  txId?: string
  mensaje?: string
}

export async function listarDatosFilas(): Promise<ClienteApi[]> {
  const j = await listarDatosApi()
  const d = j.datos
  if (d == null || !Array.isArray(d)) return []
  return d.map((row) => parseDatoDatos(row)).filter((x): x is ClienteApi => x !== null)
}

export async function listarDatosApi(): Promise<RespuestaLectura> {
  return apiJson<RespuestaLectura>('/datos', { method: 'GET' })
}

export async function crearDatoApi(dato: DatoGenerico): Promise<RespuestaMutacionDato> {
  return apiJson<RespuestaMutacionDato>('/datos', {
    method: 'POST',
    body: JSON.stringify({ datoId: dato.datoId.trim(), tipo: dato.tipo.trim(), payload: dato.payload }),
  })
}

export async function actualizarDatoApi(dato: DatoGenerico): Promise<RespuestaMutacionDato> {
  const id = encodeURIComponent(dato.datoId.trim())
  return apiJson<RespuestaMutacionDato>(`/datos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ datoId: dato.datoId.trim(), tipo: dato.tipo.trim(), payload: dato.payload }),
  })
}

export async function eliminarDatoApi(datoId: string): Promise<RespuestaMutacionDato> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaMutacionDato>(`/datos/${id}`, { method: 'DELETE' })
}

export async function consultarDatoApi(datoId: string): Promise<RespuestaLectura> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaLectura>(`/datos/${id}`, { method: 'GET' })
}

export async function fetchHistorialDato(datoId: string): Promise<RespuestaLectura> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaLectura>(`/datos/${id}/historial`, { method: 'GET' })
}

export async function restaurarDatoRevision(datoId: string, txId: string): Promise<RespuestaMutacionDato> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaMutacionDato>(`/datos/${id}/restaurar`, {
    method: 'POST',
    body: JSON.stringify({ txId: txId.trim() }),
  })
}


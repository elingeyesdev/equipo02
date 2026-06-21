import { apiJson } from './apiClient'
import { operacionesHistorialDesdeRespuesta, type HistorialFilaVista } from '../lib/historialDato'
import { fetchHistorialDato } from './apiDatos'

export type { HistorialFilaVista, AccionLineaTiempo, LineaTiempoRespuesta } from '../lib/historialDato'

export async function fetchHistorialDatoCompleto(datoId: string): Promise<HistorialFilaVista[]> {
  const id = encodeURIComponent(datoId.trim())
  const res = await apiJson<{ ok?: boolean; datos?: unknown }>(`/datos/${id}/historial`, { method: 'GET' })
  return operacionesHistorialDesdeRespuesta(res.datos)
}

/** @deprecated Usar fetchHistorialDatoCompleto — alias de compatibilidad interna. */
export async function fetchHistorialCliente(clienteId: string): Promise<{ clienteId: string; operaciones: HistorialFilaVista[] }> {
  const ops = await fetchHistorialDatoCompleto(clienteId)
  return { clienteId, operaciones: ops }
}

export function operacionesAVista(h: { operaciones: HistorialFilaVista[] }): HistorialFilaVista[] {
  return h.operaciones
}

export { fetchHistorialDato }

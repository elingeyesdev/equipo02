import { apiJson } from './apiClient'
import { parseClienteDatos } from '../lib/apiClienteAdapter'
import type { ClienteApi, HistorialClienteApi } from '../types/api'

export async function fetchHistorialCliente(clienteId: string): Promise<HistorialClienteApi> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<HistorialClienteApi>(`/clientes/historial/${id}`, { method: 'GET' })
}

export type AccionLineaTiempo = {
  tipo: 'creado' | 'editado' | 'baja' | 'restaurado'
  etiqueta: string
  fecha: string
  txId: string
  restauradoDesdeTxId?: string
}

export type LineaTiempoRespuesta = {
  ok: boolean
  clienteId: string
  acciones: AccionLineaTiempo[]
}

export async function fetchLineaTiempoCliente(clienteId: string): Promise<LineaTiempoRespuesta> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<LineaTiempoRespuesta>(`/clientes/historial-resumido/${id}`, { method: 'GET' })
}

export type HistorialFilaVista = {
  txId: string
  timestamp: string
  isDelete: boolean
  resumen: string
  cliente?: ClienteApi | null
  /** Record crudo del ledger (dato_cc / cliente_cc). */
  record?: unknown
  /** Anotado por el middleware al consultar historial de datos. */
  restauradoDesdeTxId?: string
}

export function operacionesAVista(h: HistorialClienteApi): HistorialFilaVista[] {
  // El chaincode devuelve más reciente primero. Ordenamos ascendente para que
  // rows[0] sea la creación original y rows[i-1] sea la versión anterior real.
  const ordenadas = [...h.operaciones].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  return ordenadas.map((op) => {
    const rec = op.record ? parseClienteDatos(op.record) : null
    const resumen = rec
      ? `${rec.nombre ?? ''} (${rec.estado ?? ''})`.trim() || op.txId
      : op.isDelete
        ? 'Baja / borrado lógico'
        : 'Sin registro'
    return {
      txId: op.txId,
      timestamp: op.timestamp,
      isDelete: op.isDelete,
      resumen,
      cliente: rec,
      record: op.record ?? null,
    }
  })
}

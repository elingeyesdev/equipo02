import { parseDatoDatos } from './datoApiAdapter'
import { extraerPayloadDato } from './datoPayload'

export type HistorialFilaVista = {
  txId: string
  timestamp: string
  isDelete: boolean
  resumen: string
  cliente?: unknown
  record?: unknown
  restauradoDesdeTxId?: string
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

/** Normaliza la respuesta de GET /datos/{datoId}/historial. */
export function operacionesHistorialDesdeRespuesta(datos: unknown): HistorialFilaVista[] {
  const raw = Array.isArray(datos) ? datos : []
  return raw
    .map((op: unknown) => {
      const item = op && typeof op === 'object' ? (op as Record<string, unknown>) : {}
      const rec = parseDatoDatos(item.record)
      return {
        txId: String(item.txId ?? ''),
        timestamp: String(item.timestamp ?? ''),
        isDelete: Boolean(item.isDelete),
        resumen: rec
          ? `${rec.nombre} (${rec.estado})`
          : item.isDelete
            ? 'Baja / borrado lógico'
            : String((item.record as Record<string, unknown> | undefined)?.datoId ?? 'Sin registro'),
        cliente: item.record ?? null,
        record: item.record ?? null,
        restauradoDesdeTxId:
          typeof item.restauradoDesdeTxId === 'string' ? item.restauradoDesdeTxId.trim() : undefined,
      } satisfies HistorialFilaVista
    })
    .filter((x) => x.txId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function historialConPayloads(datos: unknown): {
  filas: HistorialFilaVista[]
  payloads: Array<Record<string, unknown> | null>
} {
  const raw = Array.isArray(datos) ? datos : []
  const combinado = raw
    .map((op: unknown) => {
      const item = op && typeof op === 'object' ? (op as Record<string, unknown>) : {}
      const rec = parseDatoDatos(item.record)
      const fila: HistorialFilaVista = {
        txId: String(item.txId ?? ''),
        timestamp: String(item.timestamp ?? ''),
        isDelete: Boolean(item.isDelete),
        resumen: rec
          ? `${rec.nombre} (${rec.estado})`
          : item.isDelete
            ? 'Baja / borrado lógico'
            : String((item.record as Record<string, unknown> | undefined)?.datoId ?? 'Sin registro'),
        cliente: item.record ?? null,
        record: item.record ?? null,
        restauradoDesdeTxId:
          typeof item.restauradoDesdeTxId === 'string' ? item.restauradoDesdeTxId.trim() : undefined,
      }
      return { fila, payload: extraerPayloadDato(item.record) }
    })
    .filter((x) => x.fila.txId)
    .sort((a, b) => new Date(a.fila.timestamp).getTime() - new Date(b.fila.timestamp).getTime())
  return {
    filas: combinado.map((x) => x.fila),
    payloads: combinado.map((x) => x.payload),
  }
}

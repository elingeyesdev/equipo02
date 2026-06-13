import { parseClienteDatos } from './apiClienteAdapter'
import { parseDatoDatos } from './datoApiAdapter'
import { decodeIfBase64 } from './ledgerFieldDecode'
import { autorRolDisplayDesdeNotas } from './notasLedger'
import type { HistorialFilaVista } from '../services/apiHistorialCliente'

export type FilaAuditoriaTabla = {
  id: string
  codigo: string
  nombre: string
  fecha: string
  estado: string
  bloque: string
  firma: string
  enlace: string
  autor: string
  cliente: unknown
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function recordToDisplay(record: unknown, isAgricultura: boolean): { codigo: string; nombre: string; estado: string; fullObj: unknown } {
  let fullObj: unknown = record
  let codigo = '—'
  let nombre = '—'
  let estado = '—'

  if (!record) return { codigo, nombre, estado, fullObj }

  if (isAgricultura) {
    const parsed = parseDatoDatos(record)
    if (parsed) {
      codigo = parsed.clienteId
      nombre = parsed.nombre
      estado = parsed.estado
      fullObj = record
    } else if (record && typeof record === 'object') {
      const rec = record as Record<string, unknown>
      const payload = rec.payload && typeof rec.payload === 'object' ? (rec.payload as Record<string, unknown>) : null
      codigo = str(rec.datoId || payload?.codigo_trazabilidad || payload?.datoId || '—')
      nombre = str(payload?.nombre || codigo)
      estado = str(payload?.estado || rec.tipo || '—')
    }
  } else {
    const parsed = parseClienteDatos(record)
    if (parsed) {
      fullObj = parsed
      codigo = parsed.clienteId
      nombre = parsed.nombre
      estado = parsed.estado
    }
  }

  return { codigo: decodeIfBase64(codigo), nombre: decodeIfBase64(nombre), estado, fullObj }
}

/** Convierte operaciones de historial del ledger en filas para la tabla de Auditar. */
export function filasDesdeHistorialOps(
  datoId: string,
  ops: HistorialFilaVista[],
  isAgricultura: boolean,
): FilaAuditoriaTabla[] {
  return ops.map((op, idx) => {
    const { codigo, nombre, estado, fullObj } = recordToDisplay(op.cliente, isAgricultura)
    const rec = op.cliente && typeof op.cliente === 'object' ? (op.cliente as unknown as Record<string, unknown>) : null
    const autor = autorRolDisplayDesdeNotas(
      typeof rec?.notas === 'string' ? rec.notas : rec?.notasLedger,
    )

    return {
      id: `h-${datoId}-${idx}-${op.txId}`,
      codigo: codigo !== '—' ? codigo : datoId,
      nombre,
      fecha: op.timestamp,
      estado: op.isDelete ? 'BAJA' : estado !== '—' ? estado : 'LEDGER_TX',
      bloque: '—',
      firma: op.txId,
      enlace: `sha256:tx-${op.txId.slice(0, 12)}`,
      autor,
      cliente: fullObj,
    }
  })
}

export function filaEnRangoFecha(fecha: string, desdeDia: string, hastaDia: string): boolean {
  if (!desdeDia.trim() && !hastaDia.trim()) return true
  const t = new Date(fecha).getTime()
  if (Number.isNaN(t)) return true

  if (desdeDia.trim()) {
    const desde = new Date(`${desdeDia.trim()}T00:00:00.000Z`).getTime()
    if (t < desde) return false
  }
  if (hastaDia.trim()) {
    const hasta = new Date(`${hastaDia.trim()}T23:59:59.999Z`).getTime()
    if (t > hasta) return false
  }
  return true
}

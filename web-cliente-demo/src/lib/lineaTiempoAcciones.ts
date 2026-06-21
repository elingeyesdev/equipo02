import type { AccionLineaTiempo, HistorialFilaVista } from './historialDato'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function parsePayloadJson(v: unknown): Record<string, unknown> | null {
  if (typeof v === 'string') {
    try {
      return parsePayloadJson(JSON.parse(v))
    } catch {
      return null
    }
  }
  return asRecord(v)
}

/** Extrae el payload de negocio desde un record de dato_cc o un objeto plano. */
function payloadDesdeRecord(record: unknown): Record<string, unknown> | null {
  let rec = record
  if (typeof rec === 'string') {
    try {
      rec = JSON.parse(rec)
    } catch {
      return null
    }
  }
  const o = asRecord(rec)
  if (!o) return null

  const fromField = parsePayloadJson(o.payload ?? o.payloadDecodificado)
  if (fromField) return fromField

  if ('_baasMeta' in o) return o
  return null
}

/** Lee `_baasMeta.restauradoDesdeTxId` del payload de un record de historial. */
export function metaRestauracionDesdeRecord(record: unknown): string | null {
  const payload = payloadDesdeRecord(record)
  if (!payload) return null
  const meta = asRecord(payload._baasMeta)
  if (!meta) return null
  const tx = meta.restauradoDesdeTxId
  return typeof tx === 'string' && tx.trim() ? tx.trim() : null
}

function restauracionDesdeOp(op: HistorialFilaVista): string | null {
  const directo = op.restauradoDesdeTxId?.trim()
  if (directo) return directo
  return metaRestauracionDesdeRecord(op.record ?? op.cliente)
}

export function buildAccionesFromHistorial(ops: HistorialFilaVista[]): AccionLineaTiempo[] {
  let edicionNum = 0
  let restauracionNum = 0

  return ops.map((op, idx) => {
    const restauradoDesde = restauracionDesdeOp(op)

    if (idx === 0) {
      return {
        tipo: 'creado' as const,
        etiqueta: 'Creado',
        fecha: op.timestamp,
        txId: op.txId,
      }
    }
    if (op.isDelete) {
      return {
        tipo: 'baja' as const,
        etiqueta: 'Baja',
        fecha: op.timestamp,
        txId: op.txId,
      }
    }
    if (restauradoDesde) {
      restauracionNum += 1
      return {
        tipo: 'restaurado' as const,
        etiqueta: `Restauración #${restauracionNum}`,
        fecha: op.timestamp,
        txId: op.txId,
        restauradoDesdeTxId: restauradoDesde,
      }
    }
    edicionNum += 1
    return {
      tipo: 'editado' as const,
      etiqueta: `Edición #${edicionNum}`,
      fecha: op.timestamp,
      txId: op.txId,
    }
  })
}

export function estiloAccionLineaTiempo(tipo: AccionLineaTiempo['tipo']): {
  chip: string
  icon: string
  text: string
} {
  switch (tipo) {
    case 'creado':
      return {
        chip: 'border-emerald-200 bg-emerald-50',
        icon: 'bg-emerald-100 text-emerald-800',
        text: 'text-emerald-900',
      }
    case 'baja':
      return {
        chip: 'border-red-200 bg-red-50',
        icon: 'bg-red-100 text-red-800',
        text: 'text-red-900',
      }
    case 'restaurado':
      return {
        chip: 'border-amber-200 bg-amber-50',
        icon: 'bg-amber-100 text-amber-900',
        text: 'text-amber-900',
      }
    default:
      return {
        chip: 'border-[#cbd5e1] bg-white',
        icon: 'bg-[#e8edf3] text-[#1a3a5c]',
        text: 'text-[#1a2332]',
      }
  }
}

export function iconoAccionLineaTiempo(tipo: AccionLineaTiempo['tipo']): string {
  switch (tipo) {
    case 'creado':
      return '★'
    case 'baja':
      return '✖'
    case 'restaurado':
      return '↩'
    default:
      return '✎'
  }
}

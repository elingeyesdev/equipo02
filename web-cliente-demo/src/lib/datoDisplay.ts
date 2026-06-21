import { parseDatoDatos } from './datoApiAdapter'
import { extraerPayloadDato } from './datoPayload'
import { displayLedgerField } from './ledgerFieldDecode'

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

/** Filas legibles para detalle/historial de un registro dato_cc. */
export function datoFilasLegibles(record: unknown): Array<{ key: string; value: string }> {
  const parsed = parseDatoDatos(record)
  const raw = record && typeof record === 'object' ? (record as Record<string, unknown>) : null
  const payload = extraerPayloadDato(record)
  const out: Array<{ key: string; value: string }> = []

  if (parsed) {
    out.push(
      { key: 'datoId', value: parsed.clienteId },
      { key: 'tipo', value: raw && typeof raw.tipo === 'string' ? raw.tipo : parsed.tipoDocumento },
      { key: 'resumen', value: parsed.nombre },
      { key: 'estado', value: parsed.estado },
    )
  } else if (raw) {
    out.push(
      { key: 'datoId', value: str(raw.datoId) },
      { key: 'tipo', value: str(raw.tipo) },
    )
  }

  if (payload) {
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'notas' || k === 'notasLedger' || k === '_baasMeta') continue
      out.push({ key: `payload.${k}`, value: typeof v === 'object' ? JSON.stringify(v) : str(v) })
    }
  }

  return out.filter((r) => r.value.trim() !== '')
}

export function displayDatoField(key: string, value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return displayLedgerField(key, value) || String(value ?? '(vacío)')
}

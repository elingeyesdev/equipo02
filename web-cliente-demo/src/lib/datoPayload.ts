/** Extrae el `payload` de un registro dato_cc (objeto completo o payload directo). */
export function extraerPayloadDato(datos: unknown): Record<string, unknown> | null {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null
  const o = datos as Record<string, unknown>
  let payloadRaw: unknown = o.payload
  if (typeof payloadRaw === 'string') {
    try {
      payloadRaw = JSON.parse(payloadRaw)
    } catch {
      payloadRaw = null
    }
  }
  if (payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw)) {
    return payloadRaw as Record<string, unknown>
  }
  if ('actividades' in o || 'producciones' in o || 'codigo_trazabilidad' in o || 'cultivo' in o || 'diagnostico' in o) {
    return o
  }
  return null
}

/** @deprecated Alias histórico — usar extraerPayloadDato. */
export const extraerPayloadLote = extraerPayloadDato

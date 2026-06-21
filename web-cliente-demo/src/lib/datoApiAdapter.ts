import type { ClienteApiCacheRow } from '../types/api'

/** Normaliza `datos` de `GET /datos/:datoId` a una fila reutilizable en UI. */
export function parseDatoDatos(datos: unknown): ClienteApiCacheRow | null {
  if (!datos || typeof datos !== 'object') return null
  const o = datos as Record<string, unknown>
  const datoId = typeof o.datoId === 'string' ? o.datoId : ''
  if (!datoId.trim()) return null
  const payload = o.payload && typeof o.payload === 'object' ? (o.payload as Record<string, unknown>) : null
  const nombre =
    (payload && typeof payload.nombre === 'string' ? payload.nombre : '') ||
    (payload && typeof payload.codigo_trazabilidad === 'string' ? payload.codigo_trazabilidad : '') ||
    datoId
  const fechaAlta =
    (typeof o.fechaActualizacion === 'string' ? o.fechaActualizacion : '') ||
    (typeof o.fechaCreacion === 'string' ? o.fechaCreacion : '') ||
    (payload && typeof payload.fechacreacion === 'string' ? payload.fechacreacion : '') ||
    ''
  const estado =
    (payload && typeof payload.estado === 'string' ? payload.estado : '') ||
    (typeof o.tipo === 'string' ? o.tipo : '') ||
    'ACTIVO'
  const tipo = typeof o.tipo === 'string' ? o.tipo : 'dato'
  const codigo = payload && typeof payload.codigo_trazabilidad === 'string' ? payload.codigo_trazabilidad : ''
  const notas = payload ? `tipo=${tipo}${codigo ? ` · codigo=${codigo}` : ''}` : undefined
  return {
    clienteId: datoId,
    nombre,
    tipoDocumento: tipo,
    numeroDocumento: codigo,
    fechaAlta,
    estado,
    notas,
  }
}


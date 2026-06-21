import { formatDemoDateTime, formatShortDate } from '../lib/format'
import { extraerPayloadLote } from '../lib/datoPayload'

export { extraerPayloadLote }

type Dict = Record<string, unknown>

function asArray(v: unknown): Dict[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is Dict => !!x && typeof x === 'object' && !Array.isArray(x))
}

function str(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function fecha(v: unknown): string {
  const s = str(v)
  if (!s) return '—'
  const out = formatDemoDateTime(s)
  return out || s
}

function fechaCorta(v: unknown): string {
  const s = str(v)
  if (!s) return '—'
  return formatShortDate(s) || s
}


function ResumenItem({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-secondary">{value}</dd>
    </div>
  )
}

/**
 * Muestra el "proceso" de un lote agrícola guardado en `dato_cc`:
 * resumen del lote + tabla de actividades + tabla de producciones.
 * Acepta el `dato` completo o directamente el `payload`.
 */
export default function LoteProcesoPanel({
  datos,
  titulo = 'Proceso del lote',
  compacto = false,
}: {
  datos: unknown
  titulo?: string
  compacto?: boolean
}) {
  const payload = extraerPayloadLote(datos)
  if (!payload) {
    return <p className="text-xs text-muted">Sin datos de proceso para este lote.</p>
  }

  const actividades = asArray(payload.actividades)
  const producciones = asArray(payload.producciones)

  const superficie = str(payload.superficie)
  const unidadSup = str(payload.unidad_superficie)

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>

      {!compacto && (
        <dl className="grid gap-3 rounded-xl border border-line/60 bg-gray-50 p-4 text-sm sm:grid-cols-3">
          <ResumenItem label="Cultivo" value={str(payload.cultivo) || '—'} />
          <ResumenItem label="Agricultor" value={str(payload.agricultor)} />
          <ResumenItem label="Estado" value={str(payload.estado) || '—'} />
          <ResumenItem label="Código trazabilidad" value={str(payload.codigo_trazabilidad)} />
          <ResumenItem label="Ubicación" value={str(payload.ubicacion)} />
          <ResumenItem
            label="Superficie"
            value={superficie ? `${superficie}${unidadSup ? ` ${unidadSup}` : ''}` : ''}
          />
          <ResumenItem label="Fecha de siembra" value={payload.fechasiembra ? fechaCorta(payload.fechasiembra) : ''} />
          <ResumenItem label="Sincronizado" value={payload.sincronizadoEn ? fecha(payload.sincronizadoEn) : ''} />
        </dl>
      )}

      {/* Actividades */}
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-gray-50 px-4 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">Actividades</h4>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-[#374151]">
            {actividades.length}
          </span>
        </div>
        {actividades.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted">Este lote no tiene actividades registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 font-semibold">Prioridad</th>
                  <th className="px-3 py-2 font-semibold">Inicio</th>
                  <th className="px-3 py-2 font-semibold">Fin</th>
                  <th className="px-3 py-2 font-semibold">Responsable</th>
                  <th className="px-3 py-2 font-semibold">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {actividades.map((a, i) => (
                  <tr key={str(a.actividadid) || i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-ink-secondary">{str(a.tipo) || '—'}</td>
                    <td className="px-3 py-2 text-ink-secondary">{str(a.descripcion) || '—'}</td>
                    <td className="px-3 py-2 text-ink-secondary">{str(a.prioridad) || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{fecha(a.fechainicio)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{fecha(a.fechafin)}</td>
                    <td className="px-3 py-2 text-ink-secondary">{str(a.usuario) || '—'}</td>
                    <td className="px-3 py-2 text-muted">{str(a.observaciones) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Producciones */}
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-gray-50 px-4 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">Producciones</h4>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-[#374151]">
            {producciones.length}
          </span>
        </div>
        {producciones.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted">Este lote no tiene producciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Cantidad</th>
                  <th className="px-3 py-2 font-semibold">Unidad</th>
                  <th className="px-3 py-2 font-semibold">Destino</th>
                  <th className="px-3 py-2 font-semibold">Fecha cosecha</th>
                  <th className="px-3 py-2 font-semibold">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {producciones.map((p, i) => (
                  <tr key={str(p.produccionid) || i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-ink">{str(p.cantidad) || '—'}</td>
                    <td className="px-3 py-2 text-ink-secondary">{str(p.unidad) || '—'}</td>
                    <td className="px-3 py-2 text-ink-secondary">{str(p.destino) || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{fechaCorta(p.fechacosecha)}</td>
                    <td className="px-3 py-2 text-muted">{str(p.observaciones) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

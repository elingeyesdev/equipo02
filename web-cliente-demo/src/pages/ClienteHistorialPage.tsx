import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { clienteFilasLegibles, displayClienteField } from '../lib/clienteDisplay'
import { fetchHistorialCliente, operacionesAVista } from '../services/apiHistorialCliente'
import { fetchHistorialDato } from '../services/apiDatos'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import LoteProcesoPanel, { extraerPayloadLote } from '../components/LoteProcesoPanel'
import LineaTiempoStrip from '../components/LineaTiempoStrip'
import type { HistorialFilaVista, AccionLineaTiempo } from '../services/apiHistorialCliente'
import { buildAccionesFromHistorial } from '../lib/lineaTiempoAcciones'

const btn =
  'admin-btn-primary shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

export default function ClienteHistorialPage() {
  const { tenant } = useSettings()
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'
  const { clienteId: clienteIdParam } = useParams()
  const clienteId = decodeURIComponent(clienteIdParam ?? '').trim()
  const [rows, setRows] = useState<HistorialFilaVista[]>([])
  const [lotePayloads, setLotePayloads] = useState<Array<Record<string, unknown> | null>>([])
  const [timeline, setTimeline] = useState<AccionLineaTiempo[]>([])
  const [timelineVisible, setTimelineVisible] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    setError(null)
    try {
      if (isAgricultura) {
        const r = await fetchHistorialDato(clienteId)
        const datos = Array.isArray(r.datos) ? r.datos : []
        const mapped = datos
          .map((op: any) => {
            const rec = parseDatoDatos(op?.record)
            return {
            fila: {
              txId: String(op?.txId ?? ''),
              timestamp: String(op?.timestamp ?? ''),
              isDelete: Boolean(op?.isDelete),
              resumen: rec
                ? `${rec.nombre} (${rec.estado})`
                : String(op?.record?.datoId ?? 'Sin registro'),
              cliente: op?.record ?? null,
              record: op?.record ?? null,
              restauradoDesdeTxId:
                typeof op?.restauradoDesdeTxId === 'string' ? op.restauradoDesdeTxId.trim() : undefined,
            } as HistorialFilaVista,
            payload: extraerPayloadLote(op?.record),
          }})
          .filter((x) => x.fila.txId)
          .sort((a, b) => new Date(a.fila.timestamp).getTime() - new Date(b.fila.timestamp).getTime())
        setRows(mapped.map((x) => x.fila))
        setLotePayloads(mapped.map((x) => x.payload))
        setTimeline(buildAccionesFromHistorial(mapped.map((x) => x.fila)))
      } else {
        const h = await fetchHistorialCliente(clienteId)
        const ops = operacionesAVista(h)
        setRows(ops)
        setLotePayloads([])
        setTimeline(buildAccionesFromHistorial(ops))
      }
    } catch (e) {
      setError(describeApiError(e))
      setRows([])
      setLotePayloads([])
    } finally {
      setLoading(false)
    }
  }, [clienteId, isAgricultura])

  useEffect(() => {
    void load()
  }, [load])

  if (!clienteId) {
    return (
      <div className="p-6 text-sm text-muted">
        clienteId no válido.{' '}
        <Link className="text-accent hover:underline" to="/app/clientes-registrados">
          Volver al listado
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Historial en cadena</h1>
          <p className="mt-0.5 text-xs text-muted font-mono">{clienteId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || timeline.length === 0}
            onClick={() => setTimelineVisible((v) => !v)}
            className={`inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm transition-colors disabled:opacity-50 ${
              timelineVisible
                ? 'border-accent bg-accent text-white hover:bg-accent-hover'
                : 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/20'
            }`}
          >
            {timelineVisible ? 'Ocultar línea' : 'Línea de tiempo'}
          </button>
          <button type="button" className={btn} disabled={loading} onClick={() => void load()}>
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
          <Link
            to="/app/consultas"
            state={{ clienteId }}
            className="inline-flex items-center justify-center rounded-md border border-line bg-gray-50 px-4 py-2.5 text-sm text-ink-secondary hover:bg-gray-100"
          >
            Ver detalle
          </Link>
          <Link to="/app/clientes-registrados" className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink-secondary">
            Listado
          </Link>
        </div>
      </div>

      {error ? <p className="shrink-0 text-sm text-danger/90">{error}</p> : null}

      {timelineVisible && timeline.length > 0 ? (
        <div className="shrink-0 rounded-xl border border-accent/20 bg-accent/5 px-4 shadow-sm">
          <LineaTiempoStrip
            registroId={clienteId}
            acciones={timeline}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            onClose={() => setTimelineVisible(false)}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden admin-card shadow-card">
        <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-gray-50 text-xs uppercase text-muted backdrop-blur-sm">
            <tr>
              <th className="px-4 py-2 font-medium">txId</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Resumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading && rows.length === 0 && !error ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Sin operaciones devueltas para este cliente.
                </td>
              </tr>
            ) : null}
            {rows.map((r, i) => {
              const acc = timeline[i]
              const isSelected = selectedIdx === i
              return (
              <Fragment key={`${r.txId}-${r.timestamp}`}>
              <tr 
                className={`cursor-pointer transition-colors ${isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent/25' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedIdx(isSelected ? null : i)}
              >
                <td className="px-4 py-2 font-mono text-xs text-ink-secondary">{r.txId.slice(0, 8)}...</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatDemoDateTime(r.timestamp)}</td>
                <td className="px-4 py-2 text-xs">
                  {acc?.tipo === 'restaurado' ? (
                    <span className="text-amber-600 font-semibold">Restauración</span>
                  ) : r.isDelete ? (
                    <span className="text-rose-300">Baja</span>
                  ) : i === 0 ? (
                    <span className="text-emerald-400">Creación</span>
                  ) : (
                    <span className="text-ink-secondary">Cambio</span>
                  )}
                </td>
                <td className="max-w-md px-4 py-2 text-ink-secondary">
                  <div className="flex items-center justify-between">
                    <span>{r.resumen}</span>
                    <span className="text-[10px] text-accent uppercase font-semibold">{selectedIdx === i ? 'Cerrar' : 'Ver cambios'}</span>
                  </div>
                </td>
              </tr>
              </Fragment>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Panel de Comparación (Tipo GitHub Mejorado) */}
      {selectedIdx !== null && rows[selectedIdx] && (
        <div className="rounded-2xl border border-accent/30 bg-gray-50 p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Detalle de la transacción</h3>
              <p className="text-[10px] text-muted font-mono">{rows[selectedIdx].txId}</p>
            </div>
            <button onClick={() => setSelectedIdx(null)} className="rounded-md bg-gray-50 px-3 py-1.5 text-xs text-ink-secondary hover:bg-gray-100">Cerrar</button>
          </div>

          {isAgricultura && lotePayloads[selectedIdx] ? (
            <div className="mb-6 rounded-xl border border-line/60 bg-surface/20 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Proceso del lote en esta revisión
              </p>
              <LoteProcesoPanel datos={lotePayloads[selectedIdx]} titulo="Actividades y producciones registradas" />
            </div>
          ) : null}

          {selectedIdx === 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Registro Inicial
              </div>
              <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-surface/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-500/10 text-[10px] uppercase text-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Campo</th>
                      <th className="px-4 py-2 font-semibold">Valor Registrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {clienteFilasLegibles(rows[selectedIdx].cliente).map(({ key, value }) => (
                      <tr key={key} className="group">
                        <td className="px-4 py-2.5 font-medium text-muted">{key}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              key === 'informacionAuditoria'
                                ? 'bg-gray-50 text-[10px] text-muted whitespace-pre-wrap'
                                : 'bg-emerald-500/10 text-emerald-300'
                            }`}
                          >
                            {displayClienteField(key, value)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-line bg-surface/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Campo</th>
                      <th className="px-4 py-2 font-semibold">Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {clienteFilasLegibles(rows[selectedIdx].cliente).map(({ key, value }) => {
                      const prevRow = clienteFilasLegibles(rows[selectedIdx - 1].cliente).find((r) => r.key === key)
                      const prevVal = prevRow?.value ?? ''
                      const hasChanged = prevVal !== value

                      return (
                        <tr key={key} className={hasChanged ? 'bg-accent/5' : ''}>
                          <td className={`px-4 py-2.5 font-medium ${hasChanged ? 'text-accent' : 'text-muted'}`}>{key}</td>
                          <td className="px-4 py-2.5">
                            {hasChanged ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300/60 line-through">
                                  {displayClienteField(key, prevVal)}
                                </span>
                                <span className="text-muted text-[10px]">→</span>
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-medium text-emerald-400">
                                  {displayClienteField(key, value)}
                                </span>
                              </div>
                            ) : (
                              <span
                                className={
                                  key === 'informacionAuditoria'
                                    ? 'text-[10px] text-muted whitespace-pre-wrap'
                                    : 'text-muted'
                                }
                              >
                                {displayClienteField(key, value)}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex items-center gap-4 text-[10px] text-muted">
             <div className="flex items-center gap-1.5">
               <div className="h-2 w-2 rounded-full bg-rose-500/50"></div>
               <span>Eliminado / Anterior</span>
             </div>
             <div className="flex items-center gap-1.5">
               <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
               <span>Agregado / Nuevo</span>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

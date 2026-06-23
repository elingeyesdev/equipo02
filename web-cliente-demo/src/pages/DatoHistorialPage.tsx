import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { datoFilasLegibles, displayDatoField } from '../lib/datoDisplay'
import { fetchHistorialDato, restaurarDatoRevision } from '../services/apiDatos'
import { historialConPayloads, type HistorialFilaVista } from '../lib/historialDato'
import LoteProcesoPanel from '../components/LoteProcesoPanel'
import LineaTiempoStrip from '../components/LineaTiempoStrip'
import { buildAccionesFromHistorial } from '../lib/lineaTiempoAcciones'
import {
  etiquetaBotonRestaurar,
  mensajeConfirmRestaurar,
  puedeProponerRestauracion,
  resolverAvisoRestaurar,
  type AvisoRestaurar,
} from '../lib/restaurarRevisionUi'
import RestaurarRevisionAviso from '../components/RestaurarRevisionAviso'

const btn =
  'admin-btn-primary shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

export default function DatoHistorialPage() {
  const { datoId: datoIdParam } = useParams()
  const { role } = useSettings()
  const datoId = decodeURIComponent(datoIdParam ?? '').trim()
  const [rows, setRows] = useState<HistorialFilaVista[]>([])
  const [payloads, setPayloads] = useState<Array<Record<string, unknown> | null>>([])
  const [timeline, setTimeline] = useState(buildAccionesFromHistorial([]))
  const [timelineVisible, setTimelineVisible] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restaurandoTxId, setRestaurandoTxId] = useState<string | null>(null)
  const [avisoRestaurar, setAvisoRestaurar] = useState<AvisoRestaurar | null>(null)

  const load = useCallback(async () => {
    if (!datoId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetchHistorialDato(datoId)
      const { filas, payloads: pl } = historialConPayloads(r.datos)
      setRows(filas)
      setPayloads(pl)
      setTimeline(buildAccionesFromHistorial(filas))
    } catch (e) {
      setError(describeApiError(e))
      setRows([])
      setPayloads([])
    } finally {
      setLoading(false)
    }
  }, [datoId])

  useEffect(() => {
    void load()
  }, [load])

  const restaurarRevision = useCallback(async (txId: string) => {
    if (!datoId || !txId.trim() || !puedeProponerRestauracion(role)) return
    const ok = window.confirm(mensajeConfirmRestaurar(role))
    if (!ok) return

    setRestaurandoTxId(txId)
    setError(null)
    setAvisoRestaurar(null)
    try {
      const r = await restaurarDatoRevision(datoId, txId)
      const aviso = resolverAvisoRestaurar(r)
      setAvisoRestaurar(aviso)
      if (aviso.tipo === 'confirmado') {
        await load()
        setSelectedIdx(null)
      }
    } catch (e) {
      setError(describeApiError(e))
    } finally {
      setRestaurandoTxId(null)
    }
  }, [datoId, load, role])

  const filaSeleccionada = selectedIdx !== null ? rows[selectedIdx] : null
  const esRevisionEliminada = Boolean(filaSeleccionada?.isDelete)

  if (!datoId) {
    return (
      <div className="p-6 text-sm text-muted">
        datoId no válido.{' '}
        <Link className="text-accent hover:underline" to="/app/datos-registrados">
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
          <p className="mt-0.5 font-mono text-xs text-muted">{datoId}</p>
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
            state={{ datoId }}
            className="inline-flex items-center justify-center rounded-md border border-line bg-gray-50 px-4 py-2.5 text-sm text-ink-secondary hover:bg-gray-100"
          >
            Ver detalle
          </Link>
          <Link
            to="/app/datos-registrados"
            className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink-secondary"
          >
            Listado
          </Link>
        </div>
      </div>

      {error ? <p className="shrink-0 text-sm text-danger/90">{error}</p> : null}

      {timelineVisible && timeline.length > 0 ? (
        <div className="shrink-0 rounded-xl border border-accent/20 bg-accent/5 px-4 shadow-sm">
          <LineaTiempoStrip
            registroId={datoId}
            acciones={timeline}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            onClose={() => setTimelineVisible(false)}
          />
        </div>
      ) : null}

      <div className="admin-card flex min-h-0 flex-1 flex-col overflow-hidden shadow-card">
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
                    Sin operaciones devueltas para este dato.
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
                          <span className="font-semibold text-amber-600">Restauración</span>
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
                          <span className="text-[10px] font-semibold uppercase text-accent">
                            {selectedIdx === i ? 'Cerrar' : 'Ver cambios'}
                          </span>
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

      {selectedIdx !== null && rows[selectedIdx] ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-accent/30 bg-gray-50 p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Detalle de la transacción</h3>
              <p className="font-mono text-[10px] text-muted">{rows[selectedIdx].txId}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedIdx(null)
                setAvisoRestaurar(null)
              }}
              className="rounded-md bg-gray-50 px-3 py-1.5 text-xs text-ink-secondary hover:bg-gray-100"
            >
              Cerrar
            </button>
          </div>

          {avisoRestaurar ? (
            <RestaurarRevisionAviso
              aviso={avisoRestaurar}
              datoId={datoId}
              onCerrar={() => setAvisoRestaurar(null)}
              className="mb-4"
            />
          ) : null}

          {puedeProponerRestauracion(role) ? (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                className={btn}
                disabled={restaurandoTxId === rows[selectedIdx].txId || esRevisionEliminada}
                onClick={() => void restaurarRevision(rows[selectedIdx].txId)}
                title={
                  esRevisionEliminada
                    ? 'No se puede restaurar una revisión de eliminación'
                    : role === 'integrador'
                      ? 'Enviar solicitud de restauración al administrador'
                      : 'Crear un nuevo bloque con los datos de esta revisión'
                }
              >
                {restaurandoTxId === rows[selectedIdx].txId
                  ? role === 'integrador'
                    ? 'Enviando…'
                    : 'Restaurando…'
                  : etiquetaBotonRestaurar(role)}
              </button>
            </div>
          ) : null}

          {payloads[selectedIdx] ? (
            <div className="mb-6 rounded-xl border border-line/60 bg-surface/20 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Payload de negocio en esta revisión
              </p>
              <LoteProcesoPanel datos={payloads[selectedIdx]} titulo="Contenido del activo" />
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-line bg-surface/20">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Campo</th>
                  <th className="px-4 py-2 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datoFilasLegibles(rows[selectedIdx].record).map(({ key, value }) => (
                  <tr key={key}>
                    <td className="px-4 py-2.5 font-medium text-muted">{key}</td>
                    <td className="px-4 py-2.5">{displayDatoField(key, value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

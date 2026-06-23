import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconCheck, IconCopy, IconRefresh } from '@tabler/icons-react'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { fetchHistorialDato } from '../services/apiDatos'
import { historialConPayloads, type HistorialFilaVista } from '../lib/historialDato'
import { buildAccionesFromHistorial } from '../lib/lineaTiempoAcciones'

function TxIdCell({ txId }: { txId: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(txId)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1600)
    } catch {
      /* sin portapapeles */
    }
  }

  return (
    <div className="consola-txid-cell">
      <span className="font-mono text-xs text-ink-secondary" title={txId}>
        {txId.slice(0, 8)}…
      </span>
      <button
        type="button"
        className="consola-copy-btn"
        title={copiado ? 'Copiado' : 'Copiar txId'}
        aria-label={copiado ? 'TxId copiado' : 'Copiar txId'}
        onClick={() => void copiar()}
      >
        {copiado ? <IconCheck size={14} stroke={1.75} aria-hidden /> : <IconCopy size={14} stroke={1.75} aria-hidden />}
      </button>
    </div>
  )
}

export default function DatoHistorialPage() {
  const { datoId: datoIdParam } = useParams()
  const datoId = decodeURIComponent(datoIdParam ?? '').trim()
  const [rows, setRows] = useState<HistorialFilaVista[]>([])
  const [timeline, setTimeline] = useState(buildAccionesFromHistorial([]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!datoId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetchHistorialDato(datoId)
      const { filas } = historialConPayloads(r.datos)
      setRows(filas)
      setTimeline(buildAccionesFromHistorial(filas))
    } catch (e) {
      setError(describeApiError(e))
      setRows([])
      setTimeline(buildAccionesFromHistorial([]))
    } finally {
      setLoading(false)
    }
  }, [datoId])

  useEffect(() => {
    void load()
  }, [load])

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="consola-refresh-btn"
            title="Actualizar historial"
            aria-label="Actualizar historial"
            disabled={loading}
            onClick={() => void load()}
          >
            <IconRefresh size={18} stroke={1.75} className={loading ? 'animate-spin' : undefined} />
          </button>
          <Link
            to="/app/datos-registrados"
            className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-ink-secondary"
          >
            Listado
          </Link>
        </div>
      </div>

      {error ? (
        <div className="consola-alert consola-alert--error shrink-0" role="alert">
          {error}{' '}
          <button type="button" className="consola-link consola-link-btn" onClick={() => void load()}>
            Reintentar
          </button>
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
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Cargando historial…
                  </td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 && !error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Sin operaciones devueltas para este dato.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? rows.map((r, i) => {
                    const acc = timeline[i]
                    return (
                      <tr key={`${r.txId}-${r.timestamp}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <TxIdCell txId={r.txId} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">
                          {formatDemoDateTime(r.timestamp)}
                        </td>
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
                        <td className="max-w-md px-4 py-2 text-ink-secondary">{r.resumen}</td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

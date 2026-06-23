import { useCallback, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppStore } from '../context/AppStoreContext'
import type { ClienteApi } from '../types/api'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'

export default function DatosRegistradosPage() {
  const location = useLocation()
  const focusId = useMemo(() => {
    const st = location.state as { focusId?: string } | null | undefined
    return typeof st?.focusId === 'string' && st.focusId.trim() ? st.focusId.trim() : undefined
  }, [location.state])

  const {
    datosLedger,
    datosLedgerLoading,
    datosLedgerError,
    datosLedgerAccessDenied,
    refreshDatosLedger,
  } = useAppStore()
  const rows: ClienteApi[] = datosLedger

  const load = useCallback(async () => {
    await refreshDatosLedger()
  }, [refreshDatosLedger])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!focusId || datosLedgerLoading) return
    const el = document.getElementById(`dato-row-${focusId}`)
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [focusId, datosLedgerLoading, rows.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Datos registrados</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Aquí se muestran los registros enviados a la plataforma BaaS y almacenados con trazabilidad blockchain.
        </p>
        <p className="mt-1 text-xs text-muted">Origen: GET /datos · mismos activos que el panel principal</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="admin-btn-primary" onClick={() => void load()} disabled={datosLedgerLoading}>
          {datosLedgerLoading ? 'Cargando…' : 'Refrescar'}
        </button>
        {!datosLedgerLoading && !datosLedgerError ? (
          <span className="text-sm text-muted">{rows.length} registro(s) en red.</span>
        ) : null}
      </div>
      {datosLedgerAccessDenied ? (
        <div className="admin-alert-warning">
          <p>{datosLedgerError}</p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/app/credenciales">
            Abrir Credenciales
          </Link>
        </div>
      ) : datosLedgerError ? (
        <p className="text-sm text-danger">{datosLedgerError}</p>
      ) : null}
      <div className="admin-table-wrap min-h-0 flex-1">
        {!datosLedgerLoading && rows.length === 0 && !datosLedgerError ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No hay datos en red todavía.</p>
        ) : null}
        {!datosLedgerLoading && rows.length === 0 && datosLedgerAccessDenied ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Listado no disponible. Revise credenciales y vuelva a refrescar.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="admin-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 font-medium">datoId</th>
                <th className="px-4 py-2 font-medium">nombre / resumen</th>
                <th className="px-4 py-2 font-medium">tipo</th>
                <th className="px-4 py-2 font-medium">estado</th>
                <th className="px-4 py-2 text-right font-medium">acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.clienteId}
                  id={`dato-row-${r.clienteId}`}
                  className={
                    focusId === r.clienteId
                      ? 'bg-accent-soft/60 ring-1 ring-inset ring-accent/25'
                      : undefined
                  }
                >
                  <td className="px-4 py-2 font-mono text-xs text-ink-secondary">{r.clienteId}</td>
                  <td className="px-4 py-2 text-ink">{r.nombre}</td>
                  <td className="px-4 py-2 text-muted">{r.tipoDocumento}</td>
                  <td className="px-4 py-2">
                    <ClienteLedgerEstadoBadge c={r} raw />
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-2">
                      <Link className="font-medium text-accent hover:underline" to="/app/consultas" state={{ datoId: r.clienteId }}>
                        Detalle
                      </Link>
                      <Link
                        className="text-muted hover:text-accent hover:underline"
                        to={`/app/historial-dato/${encodeURIComponent(r.clienteId)}`}
                      >
                        Historial
                      </Link>
                      <Link className="text-muted hover:text-accent hover:underline" to="/app/auditoria" state={{ recursoId: r.clienteId }}>
                        Auditar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}

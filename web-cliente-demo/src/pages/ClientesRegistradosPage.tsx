import { useCallback, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import type { ClienteApi } from '../types/api'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'

export default function ClientesRegistradosPage() {
  const { tenant } = useSettings()
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'
  const entityLabel = isAgricultura ? 'Lotes registrados' : 'Clientes registrados'
  const sourceEndpoint = isAgricultura ? 'GET /datos' : 'GET /clientes'
  const location = useLocation()
  const focusId = useMemo(() => {
    const st = location.state as { focusId?: string } | null | undefined
    return typeof st?.focusId === 'string' && st.focusId.trim() ? st.focusId.trim() : undefined
  }, [location.state])

  const {
    clientesLedger,
    clientesLedgerLoading,
    clientesLedgerError,
    clientesLedgerAccessDenied,
    refreshClientesLedger,
  } = useDemoStore()
  const rows: ClienteApi[] = clientesLedger

  const load = useCallback(async () => {
    await refreshClientesLedger()
  }, [refreshClientesLedger])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!focusId || clientesLedgerLoading) return
    const el = document.getElementById(`cliente-row-${focusId}`)
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [focusId, clientesLedgerLoading, rows.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{entityLabel}</h1>
        <p className="mt-1 text-sm text-muted">Origen: {sourceEndpoint} · mismos datos que el panel principal</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="admin-btn-primary" onClick={() => void load()} disabled={clientesLedgerLoading}>
          {clientesLedgerLoading ? 'Cargando…' : 'Refrescar'}
        </button>
        {!clientesLedgerLoading && !clientesLedgerError ? (
          <span className="text-sm text-muted">{rows.length} registro(s) en red.</span>
        ) : null}
      </div>
      {clientesLedgerAccessDenied ? (
        <div className="admin-alert-warning">
          <p>{clientesLedgerError}</p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/app/credenciales">
            Abrir Credenciales
          </Link>
        </div>
      ) : clientesLedgerError ? (
        <p className="text-sm text-danger">{clientesLedgerError}</p>
      ) : null}
      <div className="admin-table-wrap min-h-0 flex-1">
        {!clientesLedgerLoading && rows.length === 0 && !clientesLedgerError ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No hay registros en red todavía.</p>
        ) : null}
        {!clientesLedgerLoading && rows.length === 0 && clientesLedgerAccessDenied ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Listado no disponible. Revise credenciales y vuelva a refrescar.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="admin-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 font-medium">{isAgricultura ? 'datoId' : 'clienteId'}</th>
                <th className="px-4 py-2 font-medium">nombre</th>
                <th className="px-4 py-2 font-medium">{isAgricultura ? 'código' : 'documento'}</th>
                <th className="px-4 py-2 font-medium">estado</th>
                <th className="px-4 py-2 text-right font-medium">acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.clienteId}
                  id={`cliente-row-${r.clienteId}`}
                  className={
                    focusId === r.clienteId
                      ? 'bg-accent-soft/60 ring-1 ring-inset ring-accent/25'
                      : undefined
                  }
                >
                  <td className="px-4 py-2 font-mono text-xs text-ink-secondary">{r.clienteId}</td>
                  <td className="px-4 py-2 text-ink">{r.nombre}</td>
                  <td className="px-4 py-2 text-muted">
                    {r.tipoDocumento} {r.numeroDocumento}
                  </td>
                  <td className="px-4 py-2">
                    <ClienteLedgerEstadoBadge c={r} raw={isAgricultura} />
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-2">
                      {isAgricultura ? (
                        <Link className="font-medium text-accent hover:underline" to="/app/auditoria" state={{ recursoId: r.clienteId }}>
                          Auditar
                        </Link>
                      ) : (
                        <>
                          <Link className="font-medium text-accent hover:underline" to="/app/consultas" state={{ clienteId: r.clienteId }}>
                            Detalle
                          </Link>
                          <Link
                            className="text-muted hover:text-accent hover:underline"
                            to={`/app/historial-cliente/${encodeURIComponent(r.clienteId)}`}
                          >
                            Historial
                          </Link>
                        </>
                      )}
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

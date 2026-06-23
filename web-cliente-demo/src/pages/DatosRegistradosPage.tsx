import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconHistory, IconRefresh } from '@tabler/icons-react'
import { useAppStore } from '../context/AppStoreContext'
import { clienteLedgerEstadoResumen } from '../lib/clienteLedgerEstado'
import { formatShortDate } from '../lib/format'
import type { ClienteApi } from '../types/api'

const PAGE_SIZE = 25

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'sin registrar'
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins === 1) return 'hace 1 min'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours === 1) return 'hace 1 h'
  return `hace ${hours} h`
}

function resumenEstadoPrincipal(rows: ClienteApi[]): string {
  if (rows.length === 0) return 'Sin registros'
  const activos = rows.filter((r) => clienteLedgerEstadoResumen(r) === 'activo').length
  if (activos === rows.length) return `${activos} activos · sincronizados`
  if (activos === 0) return 'Sin activos'
  return `${activos} activos de ${rows.length}`
}

function resumenTipos(rows: ClienteApi[]): string {
  const tipos = [...new Set(rows.map((r) => r.tipoDocumento).filter(Boolean))].sort()
  if (tipos.length === 0) return '—'
  if (tipos.length <= 3) return tipos.join(', ')
  return `${tipos.slice(0, 3).join(', ')} +${tipos.length - 3}`
}

function etiquetaEstado(c: ClienteApi): { label: string; cls: string } {
  const s = clienteLedgerEstadoResumen(c)
  if (s === 'activo') return { label: c.estado || 'Activo', cls: 'consola-badge consola-badge--ok' }
  if (s === 'baja') return { label: c.estado || 'Dado de baja', cls: 'consola-badge consola-badge--warn' }
  return { label: c.estado || 'Inactivo', cls: 'consola-badge' }
}

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

  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const [pagina, setPagina] = useState(1)

  const load = useCallback(async () => {
    await refreshDatosLedger()
    setUltimaActualizacion(new Date())
  }, [refreshDatosLedger])

  useEffect(() => {
    void load()
  }, [load])

  const tiposUnicos = useMemo(
    () => [...new Set(datosLedger.map((r) => r.tipoDocumento).filter(Boolean))].sort(),
    [datosLedger],
  )

  const filasFiltradas = useMemo(() => {
    const q = busquedaAplicada.trim().toLowerCase()
    if (!q) return datosLedger
    return datosLedger.filter((r) => {
      const haystack = [r.clienteId, r.nombre, r.numeroDocumento, r.notas]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [datosLedger, busquedaAplicada])

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)

  const filasPagina = useMemo(() => {
    const start = (paginaActual - 1) * PAGE_SIZE
    return filasFiltradas.slice(start, start + PAGE_SIZE)
  }, [filasFiltradas, paginaActual])

  useEffect(() => {
    setPagina(1)
  }, [busquedaAplicada])

  useEffect(() => {
    if (!focusId || datosLedgerLoading) return
    const el = document.getElementById(`dato-row-${focusId}`)
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [focusId, datosLedgerLoading, datosLedger.length])

  function aplicarFiltros() {
    setBusquedaAplicada(busqueda)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setBusquedaAplicada('')
  }

  return (
    <div className="consola-inventario">
      <p className="consola-inventario-lead">
        Consulta los registros disponibles y accede al historial en cadena de cada dato.
      </p>

      {datosLedgerAccessDenied ? (
        <div className="consola-alert consola-alert--error" role="alert">
          {datosLedgerError ?? 'No se pudo acceder al inventario.'}{' '}
          <Link to="/app/credenciales" className="consola-link">
            Revisar credenciales
          </Link>
        </div>
      ) : datosLedgerError ? (
        <div className="consola-alert consola-alert--error" role="alert">
          {datosLedgerError}{' '}
          <button type="button" className="consola-link consola-link-btn" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="consola-inventario-summary">
        <div className="consola-inventario-stat">
          <span className="consola-inventario-stat-label">Total de registros</span>
          <span className="consola-inventario-stat-value">{datosLedgerLoading ? '…' : datosLedger.length}</span>
        </div>
        <div className="consola-inventario-stat">
          <span className="consola-inventario-stat-label">Tipos detectados</span>
          <span className="consola-inventario-stat-value" title={tiposUnicos.join(', ') || undefined}>
            {datosLedgerLoading ? '…' : resumenTipos(datosLedger)}
          </span>
        </div>
        <div className="consola-inventario-stat">
          <span className="consola-inventario-stat-label">Estado principal</span>
          <span className="consola-inventario-stat-value">
            {datosLedgerLoading ? '…' : resumenEstadoPrincipal(datosLedger)}
          </span>
        </div>
      </div>

      <section className="consola-panel consola-inventario-panel">
        <div className="consola-panel-head consola-inventario-head">
          <div>
            <h2 className="consola-panel-title">Inventario en red</h2>
            <p className="consola-panel-subtitle">
              {datosLedgerLoading
                ? 'Cargando registros…'
                : filasFiltradas.length === datosLedger.length
                  ? `${filasFiltradas.length} registro(s) en la red`
                  : `${filasFiltradas.length} de ${datosLedger.length} registro(s)`}
            </p>
          </div>
          <span className="consola-inventario-updated">
            Última actualización: {formatRelativeTime(ultimaActualizacion)}
          </span>
        </div>

        <div className="consola-panel-body consola-inventario-filters">
          <label className="consola-field consola-inventario-filter-field">
            <span className="consola-field-label">Búsqueda</span>
            <input
              type="search"
              className="consola-input"
              placeholder="Buscar por ID, nombre o resumen"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') aplicarFiltros()
              }}
            />
          </label>
          <div className="consola-inventario-filter-actions">
            <button type="button" className="consola-btn consola-btn--primary" onClick={aplicarFiltros}>
              Buscar
            </button>
            <button type="button" className="consola-btn consola-btn--secondary" onClick={limpiarFiltros}>
              Limpiar
            </button>
            <button
              type="button"
              className="consola-refresh-btn"
              title="Actualizar registros"
              aria-label="Actualizar registros"
              disabled={datosLedgerLoading}
              onClick={() => void load()}
            >
              <IconRefresh size={18} stroke={1.75} className={datosLedgerLoading ? 'animate-spin' : undefined} />
            </button>
          </div>
        </div>

        <div className="consola-inventario-table-area">
          {datosLedgerLoading ? (
            <div className="consola-inventario-loading" aria-busy="true">
              <div className="consola-inventario-skeleton" />
              <div className="consola-inventario-skeleton consola-inventario-skeleton--short" />
              <div className="consola-inventario-skeleton" />
            </div>
          ) : datosLedgerAccessDenied ? (
            <p className="consola-empty">Listado no disponible. Revise credenciales y vuelva a actualizar.</p>
          ) : datosLedger.length === 0 && !datosLedgerError ? (
            <p className="consola-empty">No hay registros disponibles en la red.</p>
          ) : filasFiltradas.length === 0 ? (
            <p className="consola-empty">No se encontraron registros con esa búsqueda.</p>
          ) : (
            <>
              <div className="consola-table-wrap consola-inventario-table-scroll consola-inventario-table-desktop">
                <table className="consola-table consola-inventario-table">
                  <thead>
                    <tr>
                      <th>ID del dato</th>
                      <th>Nombre / resumen</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Última actualización</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasPagina.map((r) => {
                      const estado = etiquetaEstado(r)
                      return (
                        <tr
                          key={r.clienteId}
                          id={`dato-row-${r.clienteId}`}
                          className={focusId === r.clienteId ? 'consola-inventario-row--focus' : undefined}
                        >
                          <td className="consola-inventario-id" title={r.clienteId}>
                            {r.clienteId}
                          </td>
                          <td className="consola-inventario-nombre" title={r.nombre}>
                            {r.nombre || '—'}
                          </td>
                          <td>{r.tipoDocumento || '—'}</td>
                          <td>
                            <span className={estado.cls}>{estado.label}</span>
                          </td>
                          <td className="consola-inventario-fecha">
                            {r.fechaAlta ? formatShortDate(r.fechaAlta) : '—'}
                          </td>
                          <td>
                            <Link
                              to={`/app/historial-dato/${encodeURIComponent(r.clienteId)}`}
                              className="consola-btn consola-btn--primary consola-btn--sm consola-inventario-historial-btn"
                            >
                              <IconHistory size={14} stroke={1.75} aria-hidden />
                              Ver historial
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="consola-inventario-cards consola-inventario-table-mobile">
                {filasPagina.map((r) => {
                  const estado = etiquetaEstado(r)
                  return (
                    <li
                      key={r.clienteId}
                      id={`dato-row-mobile-${r.clienteId}`}
                      className={`consola-inventario-card${focusId === r.clienteId ? ' consola-inventario-card--focus' : ''}`}
                    >
                      <div className="consola-inventario-card-head">
                        <span className="consola-inventario-id">{r.clienteId}</span>
                        <span className={estado.cls}>{estado.label}</span>
                      </div>
                      <p className="consola-inventario-card-nombre">{r.nombre || '—'}</p>
                      <dl className="consola-inventario-card-meta">
                        <div>
                          <dt>Tipo</dt>
                          <dd>{r.tipoDocumento || '—'}</dd>
                        </div>
                        <div>
                          <dt>Última actualización</dt>
                          <dd>{r.fechaAlta ? formatShortDate(r.fechaAlta) : '—'}</dd>
                        </div>
                      </dl>
                      <Link
                        to={`/app/historial-dato/${encodeURIComponent(r.clienteId)}`}
                        className="consola-btn consola-btn--primary consola-btn--sm consola-inventario-historial-btn"
                      >
                        <IconHistory size={14} stroke={1.75} aria-hidden />
                        Ver historial
                      </Link>
                    </li>
                  )
                })}
              </ul>

              {totalPaginas > 1 ? (
                <div className="consola-inventario-pagination">
                  <button
                    type="button"
                    className="consola-btn consola-btn--secondary consola-btn--sm"
                    disabled={paginaActual <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="consola-inventario-pagination-meta">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    className="consola-btn consola-btn--secondary consola-btn--sm"
                    disabled={paginaActual >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

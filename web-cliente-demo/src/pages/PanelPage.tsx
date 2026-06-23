import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconActivity,
  IconClock,
  IconDatabase,
  IconInbox,
  IconPlugConnected,
} from '@tabler/icons-react'
import { useAppShell } from '../context/AppShellContext'
import { useAppStore } from '../context/AppStoreContext'
import { useSettings } from '../context/SettingsContext'
import { formatShortDate } from '../lib/format'
import { workspaceLabel } from '../lib/roles'
import { listarSolicitudes, type Solicitud } from '../services/apiSolicitudes'
import type { ClienteApi } from '../types/api'
import type { AppRole, DemoEvent } from '../types/demo'

type ConexionTono = 'ok' | 'warn' | 'error' | 'neutral'

interface ActividadFila {
  id: string
  codigo: string
  operacion: string
  estado: string
  estadoTone: 'ok' | 'warn' | 'neutral' | 'error'
  fecha: string
  accionTo: string
  accionLabel: string
}

interface SolicitudesResumen {
  pendientes: number
  aprobadas: number
  rechazadas: number
  enRevision: number
}

function resolverConexion(
  loading: boolean,
  accessDenied: boolean,
  error: string | null,
): { tono: ConexionTono; valor: string; hint: string } {
  if (loading) return { tono: 'neutral', valor: 'Conectando', hint: 'Verificando acceso al tenant.' }
  if (accessDenied) return { tono: 'warn', valor: 'Sin permiso', hint: 'Revisa tu rol en Perfil y permisos.' }
  if (error) return { tono: 'error', valor: 'Error', hint: 'No se pudo conectar con el middleware.' }
  return { tono: 'ok', valor: 'Operativa', hint: 'Datos del tenant disponibles.' }
}

function contarSolicitudes(lista: Solicitud[]): SolicitudesResumen {
  const resumen: SolicitudesResumen = { pendientes: 0, aprobadas: 0, rechazadas: 0, enRevision: 0 }
  for (const s of lista) {
    if (s.estado === 'pendiente') resumen.pendientes += 1
    else if (s.estado === 'aprobada') resumen.aprobadas += 1
    else if (s.estado === 'rechazada') resumen.rechazadas += 1
  }
  // Reservado para un estado futuro "en_revision" del backend.
  resumen.enRevision = 0
  return resumen
}

/** Conecta aquí métricas reales de actividad diaria (últimos 7 días). */
function parseChartTimestamp(iso: string | undefined): number | null {
  if (!iso?.trim()) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

function buildActividadSemanal(datos: ClienteApi[], eventos: DemoEvent[]): { label: string; value: number }[] {
  const days: { label: string; value: number; start: number; end: number }[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const start = d.getTime()
    const end = start + 86400000
    const label = d.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')
    days.push({ label, value: 0, start, end })
  }

  const windowStart = days[0]?.start ?? 0
  let fueraDeVentana = 0
  let sinFecha = 0

  const bump = (timestamp: number | null) => {
    if (timestamp === null) {
      sinFecha += 1
      return
    }
    if (timestamp < windowStart) {
      fueraDeVentana += 1
      return
    }
    for (const day of days) {
      if (timestamp >= day.start && timestamp < day.end) {
        day.value += 1
        return
      }
    }
    fueraDeVentana += 1
  }

  for (const d of datos) bump(parseChartTimestamp(d.fechaAlta))
  for (const e of eventos) bump(parseChartTimestamp(e.fechaIso))

  // Registros sin fecha o anteriores a la ventana: reflejar en el día actual al refrescar ledger.
  const hoy = days[days.length - 1]
  if (hoy && (sinFecha > 0 || fueraDeVentana > 0)) {
    hoy.value += sinFecha + fueraDeVentana
  }

  return days.map(({ label, value }) => ({ label, value }))
}

const CHART_BAR_MAX_PX = 112

function eventoOperacionLabel(ev: DemoEvent): string {
  const map: Record<string, string> = {
    registro_creado: 'Alta de registro',
    registro_editado: 'Actualización de registro',
    registro_eliminado: 'Baja lógica',
    token_emitido: 'Emisión de token',
    token_transferido: 'Transferencia',
    consulta: 'Consulta de registro',
  }
  return map[ev.tipo] ?? ev.titulo
}

function filasActividadReciente(
  role: AppRole,
  datos: ClienteApi[],
  eventos: DemoEvent[],
): ActividadFila[] {
  const filas: ActividadFila[] = []

  for (const ev of eventos.slice(0, 4)) {
    if (role === 'solo_lectura' && ev.tipo !== 'consulta') continue
    filas.push({
      id: ev.id,
      codigo: ev.referencia?.slice(0, 12) ?? ev.id.slice(-8),
      operacion: eventoOperacionLabel(ev),
      estado: ev.estado === 'exito' ? 'Completado' : 'Error',
      estadoTone: ev.estado === 'exito' ? 'ok' : 'error',
      fecha: formatShortDate(ev.fechaIso),
      accionTo: ev.referencia ? `/app/consultas` : '/app/historial',
      accionLabel: 'Ver detalle',
    })
  }

  const datosOrden = [...datos]
    .sort((a, b) => new Date(b.fechaAlta).getTime() - new Date(a.fechaAlta).getTime())
    .slice(0, 6 - filas.length)

  for (const c of datosOrden) {
    filas.push({
      id: c.clienteId,
      codigo: c.clienteId,
      operacion: role === 'admin' ? 'Registro en tenant' : role === 'integrador' ? 'Operación registrada' : 'Registro consultado',
      estado: c.estado || 'Registrado',
      estadoTone: c.estado?.toLowerCase().includes('baja') ? 'warn' : 'ok',
      fecha: formatShortDate(c.fechaAlta),
      accionTo: '/app/datos-registrados',
      accionLabel: 'Ver detalle',
    })
  }

  return filas.slice(0, 6)
}

export default function PanelPage() {
  const { role, roleLabel } = useSettings()
  const { setPanelToolbar } = useAppShell()
  const {
    eventos,
    datosLedger,
    datosLedgerLoading,
    datosLedgerError,
    datosLedgerAccessDenied,
    refreshDatosLedger,
  } = useAppStore()

  const [pendientesCount, setPendientesCount] = useState<number | null>(null)
  const [pendientesError, setPendientesError] = useState(false)
  const [solicitudesResumen, setSolicitudesResumen] = useState<SolicitudesResumen | null>(null)
  const [refrescando, setRefrescando] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const conexion = useMemo(
    () => resolverConexion(datosLedgerLoading, datosLedgerAccessDenied, datosLedgerError),
    [datosLedgerLoading, datosLedgerAccessDenied, datosLedgerError],
  )

  const actividadSemanal = useMemo(
    () => buildActividadSemanal(datosLedger, eventos),
    [datosLedger, eventos],
  )
  const maxBar = Math.max(...actividadSemanal.map((d) => d.value), 1)
  const actividadTotal = actividadSemanal.reduce((s, d) => s + d.value, 0)
  const filasRecientes = useMemo(
    () => filasActividadReciente(role, datosLedger, eventos),
    [role, datosLedger, eventos],
  )

  const cargarPendientes = useCallback(async () => {
    try {
      const lista = await listarSolicitudes('pendiente')
      setPendientesCount(lista.length)
      setPendientesError(false)
    } catch {
      setPendientesCount(null)
      setPendientesError(true)
    }
  }, [])

  const cargarSolicitudesAdmin = useCallback(async () => {
    if (role !== 'admin') return
    try {
      const lista = await listarSolicitudes()
      setSolicitudesResumen(contarSolicitudes(lista))
    } catch {
      setSolicitudesResumen(null)
    }
  }, [role])

  const onActualizar = useCallback(async () => {
    setRefrescando(true)
    try {
      await refreshDatosLedger()
      await cargarPendientes()
      await cargarSolicitudesAdmin()
      setLastUpdated(new Date())
    } finally {
      setRefrescando(false)
    }
  }, [refreshDatosLedger, cargarPendientes, cargarSolicitudesAdmin])

  useEffect(() => {
    void cargarPendientes()
    void cargarSolicitudesAdmin()
  }, [cargarPendientes, cargarSolicitudesAdmin])

  useEffect(() => {
    if (!datosLedgerLoading && lastUpdated === null) {
      setLastUpdated(new Date())
    }
  }, [datosLedgerLoading, lastUpdated])

  useEffect(() => {
    setPanelToolbar({
      onRefresh: () => {
        void onActualizar()
      },
      refreshing: refrescando || datosLedgerLoading,
      lastUpdated,
    })
    return () => setPanelToolbar(null)
  }, [setPanelToolbar, onActualizar, refrescando, datosLedgerLoading, lastUpdated])

  const syncLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="consola-dashboard">
      {datosLedgerAccessDenied ? (
        <div className="consola-alert-banner">
          {datosLedgerError?.trim() ||
            'Tu sesión no tiene permiso para listar datos. Revisa tu rol en Perfil y permisos.'}{' '}
          <Link to="/app/credenciales" className="font-semibold text-[#2f6bff] hover:underline">
            Ir a Perfil y permisos
          </Link>
        </div>
      ) : null}

      {conexion.tono === 'error' && datosLedgerError ? (
        <div className="consola-alert-banner consola-alert-banner--error">{datosLedgerError}</div>
      ) : null}

      <section className="consola-metric-grid" aria-label="Métricas principales">
        <MetricCard
          icon={IconDatabase}
          label="Datos registrados"
          value={datosLedgerLoading ? '…' : datosLedger.length.toLocaleString('es-PE')}
          hint="Registros disponibles en la red del tenant."
          trend={conexion.tono === 'ok' ? 'Sincronizado' : undefined}
        />
        <MetricCard
          icon={IconInbox}
          label="Solicitudes pendientes"
          value={pendientesError ? '—' : pendientesCount === null ? '…' : pendientesCount.toLocaleString('es-PE')}
          hint={
            pendientesError
              ? 'No se pudieron cargar las solicitudes.'
              : 'Cambios propuestos en espera de aprobación.'
          }
        />
        <MetricCard
          icon={IconPlugConnected}
          label="Conexión Nexum"
          value={conexion.valor}
          hint={conexion.hint}
          valueClass={conexion.tono === 'ok' ? 'text-[#16a56a]' : conexion.tono === 'error' ? 'text-red-600' : undefined}
        />
        <MetricCard
          icon={IconActivity}
          label="Eventos en esta sesión"
          value={eventos.length.toLocaleString('es-PE')}
          hint="Acciones registradas en este navegador."
        />
      </section>

      <div className="consola-dash-grid-2">
        <section className="consola-panel">
          <div className="consola-panel-head">
            <h2 className="consola-panel-title">Actividad de evidencia</h2>
            <p className="consola-panel-subtitle">
              Registros enviados o consultados durante los últimos 7 días
              {actividadTotal > 0 ? ` · ${actividadTotal.toLocaleString('es-PE')} en el periodo` : ''}.
            </p>
          </div>
          <div className="consola-panel-body">
            {datosLedgerLoading && actividadTotal === 0 ? (
              <p className="consola-empty">Cargando actividad…</p>
            ) : actividadTotal === 0 ? (
              <p className="consola-empty">Sin actividad registrada en los últimos 7 días.</p>
            ) : (
              <div className="consola-chart-bars" role="img" aria-label="Gráfica de actividad semanal">
                {actividadSemanal.map((d) => {
                  const barPx = d.value === 0 ? 0 : Math.max(6, Math.round((d.value / maxBar) * CHART_BAR_MAX_PX))
                  return (
                    <div key={d.label} className="consola-chart-bar-col">
                      <span className="consola-chart-bar-value">{d.value > 0 ? d.value : ''}</span>
                      <div className="consola-chart-bar-track">
                        <div
                          className="consola-chart-bar"
                          style={{ height: `${barPx}px` }}
                          title={`${d.value} eventos`}
                        />
                      </div>
                      <span className="consola-chart-bar-label">{d.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="consola-panel">
          <div className="consola-panel-head">
            <h2 className="consola-panel-title">Estado del tenant</h2>
            <p className="consola-panel-subtitle">Salud operativa del entorno conectado.</p>
          </div>
          <div className="consola-panel-body">
            <ul className="consola-tenant-status-list">
              <TenantStatusItem
                label="Conexión activa"
                ok={conexion.tono === 'ok'}
                warn={conexion.tono === 'warn'}
                error={conexion.tono === 'error'}
                neutral={conexion.tono === 'neutral'}
              />
              <TenantStatusItem label="Middleware operativo" ok={conexion.tono === 'ok'} neutral={conexion.tono !== 'ok'} />
              <TenantStatusItem label="Hyperledger Fabric disponible" ok={conexion.tono === 'ok'} neutral={conexion.tono !== 'ok'} />
              <li className="consola-tenant-status-item">
                <span className="flex items-center gap-2">
                  <IconClock size={14} stroke={1.75} className="text-[#667085]" />
                  Última sincronización
                </span>
                <span className="text-xs font-medium text-[#667085]">{syncLabel}</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {role === 'admin' && solicitudesResumen ? (
        <section className="consola-panel">
          <div className="consola-panel-head">
            <h2 className="consola-panel-title">Solicitudes por estado</h2>
            <p className="consola-panel-subtitle">Distribución de solicitudes del tenant para supervisión.</p>
          </div>
          <div className="consola-panel-body">
            <SolicitudesEstadoChart resumen={solicitudesResumen} />
          </div>
        </section>
      ) : null}

      <section className="consola-panel">
        <div className="consola-panel-head">
          <h2 className="consola-panel-title">Actividad reciente</h2>
          <p className="consola-panel-subtitle">
            {role === 'solo_lectura'
              ? 'Consultas y registros revisados recientemente.'
              : role === 'admin'
                ? 'Solicitudes, aprobaciones y operaciones recientes.'
                : 'Operaciones enviadas o propuestas recientemente.'}
          </p>
        </div>
        <div className="consola-panel-body p-0">
          {filasRecientes.length === 0 ? (
            <p className="consola-empty">No hay actividad reciente para mostrar.</p>
          ) : (
            <div className="consola-table-wrap">
              <table className="consola-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Operación</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filasRecientes.map((f) => (
                    <tr key={f.id}>
                      <td className="font-mono text-[0.72rem]">{f.codigo}</td>
                      <td>{f.operacion}</td>
                      <td>
                        <EstadoBadge tone={f.estadoTone} label={f.estado} />
                      </td>
                      <td className="text-[#667085]">{f.fecha}</td>
                      <td>
                        <Link to={f.accionTo} className="consola-table-action">
                          {f.accionLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <p className="text-center text-[0.72rem] text-[#667085]">
        Rol activo: <span className="font-semibold text-[#17233a]">{roleLabel}</span> ·{' '}
        {workspaceLabel(role)}
      </p>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  valueClass,
}: {
  icon: typeof IconDatabase
  label: string
  value: string
  hint: string
  trend?: string
  valueClass?: string
}) {
  return (
    <article className="consola-metric-card">
      <div className="consola-metric-head">
        <Icon size={18} stroke={1.55} className="consola-metric-icon" aria-hidden />
        <p className="consola-metric-label">{label}</p>
      </div>
      <p className={`consola-metric-value ${valueClass ?? ''}`}>{value}</p>
      <p className="consola-metric-hint">{hint}</p>
      {trend ? <span className="consola-metric-trend consola-metric-trend--ok">{trend}</span> : null}
    </article>
  )
}

function TenantStatusItem({
  label,
  ok,
  warn,
  error,
  neutral,
}: {
  label: string
  ok?: boolean
  warn?: boolean
  error?: boolean
  neutral?: boolean
}) {
  const dotClass = error
    ? 'consola-status-dot consola-status-dot--error'
    : warn
      ? 'consola-status-dot consola-status-dot--warn'
      : ok
        ? 'consola-status-dot'
        : 'consola-status-dot consola-status-dot--neutral'

  const text = error ? 'Error' : warn ? 'Advertencia' : ok ? 'Activo' : neutral ? 'Verificando' : '—'

  return (
    <li className="consola-tenant-status-item">
      <span className="flex items-center gap-2">
        <span className={dotClass} aria-hidden />
        {label}
      </span>
      <span className="text-xs font-medium text-[#667085]">{text}</span>
    </li>
  )
}

function EstadoBadge({ tone, label }: { tone: 'ok' | 'warn' | 'neutral' | 'error'; label: string }) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-800'
        : tone === 'error'
          ? 'bg-red-50 text-red-700'
          : 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${cls}`}>{label}</span>
  )
}

const SOLICITUD_COLORS: Record<keyof SolicitudesResumen, string> = {
  pendientes: '#2f6bff',
  aprobadas: '#16a56a',
  rechazadas: '#dc2626',
  enRevision: '#d97706',
}

function SolicitudesEstadoChart({ resumen }: { resumen: SolicitudesResumen }) {
  const items: { key: keyof SolicitudesResumen; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'aprobadas', label: 'Aprobadas' },
    { key: 'rechazadas', label: 'Rechazadas' },
    { key: 'enRevision', label: 'En revisión' },
  ]
  const total = items.reduce((s, i) => s + resumen[i.key], 0) || 1

  return (
    <>
      <div className="consola-solicitudes-bar" aria-hidden>
        {items.map((i) =>
          resumen[i.key] > 0 ? (
            <div
              key={i.key}
              className="consola-solicitudes-seg"
              style={{
                width: `${(resumen[i.key] / total) * 100}%`,
                background: SOLICITUD_COLORS[i.key],
              }}
            />
          ) : null,
        )}
      </div>
      <div className="consola-solicitudes-legend">
        {items.map((i) => (
          <div key={i.key} className="consola-solicitudes-legend-item">
            <span className="consola-solicitudes-legend-left">
              <span className="consola-solicitudes-swatch" style={{ background: SOLICITUD_COLORS[i.key] }} />
              {i.label}
            </span>
            <strong>{resumen[i.key]}</strong>
          </div>
        ))}
      </div>
    </>
  )
}

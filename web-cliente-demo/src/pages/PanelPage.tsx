import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/ActivityFeed'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'
import { useAppStore } from '../context/AppStoreContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { formatShortDate } from '../lib/format'
import { etiquetaOrganizacion } from '../lib/organizacion'
import { listarSolicitudes } from '../services/apiSolicitudes'
import type { ClienteApi } from '../types/api'
import type { AppRole } from '../types/demo'

type ConexionTono = 'ok' | 'warn' | 'error' | 'neutral'

interface AccesoRapido {
  to: string
  label: string
}

function descripcionRol(role: AppRole): string {
  if (role === 'admin') {
    return 'Puedes registrar datos, aprobar solicitudes y auditar operaciones del tenant.'
  }
  if (role === 'integrador') {
    return 'Puedes enviar operaciones desde el sistema cliente y proponer cambios que pueden requerir aprobación del administrador.'
  }
  return 'Puedes consultar datos e historial en cadena sin modificar información.'
}

function accesosPorRol(role: AppRole): AccesoRapido[] {
  if (role === 'admin') {
    return [
      { to: '/app/datos', label: 'Actualización manual' },
      { to: '/app/solicitudes', label: 'Cola de aprobación' },
      { to: '/app/auditoria', label: 'Auditoría' },
      { to: '/app/datos-registrados', label: 'Datos registrados' },
    ]
  }
  if (role === 'integrador') {
    return [
      { to: '/app/datos', label: 'Actualización manual' },
      { to: '/app/solicitudes', label: 'Cola de aprobación' },
      { to: '/app/consultas', label: 'Consultar registro' },
      { to: '/app/datos-registrados', label: 'Datos registrados' },
    ]
  }
  return [
    { to: '/app/consultas', label: 'Consultar registro' },
    { to: '/app/datos-registrados', label: 'Datos registrados' },
    { to: '/app/credenciales', label: 'Perfil y permisos' },
  ]
}

function resolverConexion(
  loading: boolean,
  accessDenied: boolean,
  error: string | null,
): { tono: ConexionTono; valor: string; mensaje: string; pulso: boolean; hint: string } {
  if (loading) {
    return {
      tono: 'neutral',
      valor: 'Conectando',
      mensaje: 'Conectando con Nexum…',
      pulso: false,
      hint: 'Verificando acceso a los datos del tenant.',
    }
  }
  if (accessDenied) {
    return {
      tono: 'warn',
      valor: 'Sin permiso',
      mensaje: 'Tu sesión no tiene permiso para listar datos. Revisa tu rol en Perfil y permisos.',
      pulso: false,
      hint: 'Conexión inferida por carga de datos.',
    }
  }
  if (error) {
    return {
      tono: 'error',
      valor: 'Error',
      mensaje: 'No se pudo conectar con el middleware. Verifica que el servicio esté activo.',
      pulso: false,
      hint: 'Conexión inferida por carga de datos.',
    }
  }
  return {
    tono: 'ok',
    valor: 'Operativa',
    mensaje: 'Conexión activa. Los datos del tenant se cargaron correctamente.',
    pulso: true,
    hint: 'Conexión inferida por carga de datos.',
  }
}

const tonoClases: Record<
  ConexionTono,
  { borde: string; punto: string; pulso: string; texto: string; valor: string }
> = {
  ok: {
    borde: 'border-emerald-200/80 bg-emerald-50/60',
    punto: 'bg-emerald-500',
    pulso: 'bg-emerald-400/40',
    texto: 'text-emerald-800',
    valor: 'text-success',
  },
  warn: {
    borde: 'border-amber-200/80 bg-amber-50/60',
    punto: 'bg-amber-500',
    pulso: 'bg-amber-400/40',
    texto: 'text-amber-900',
    valor: 'text-amber-800',
  },
  error: {
    borde: 'border-red-200/80 bg-red-50/60',
    punto: 'bg-red-500',
    pulso: 'bg-red-400/40',
    texto: 'text-red-800',
    valor: 'text-danger',
  },
  neutral: {
    borde: 'border-line/60 bg-[#f9fafb]',
    punto: 'bg-gray-400',
    pulso: 'bg-gray-300/50',
    texto: 'text-[#6b7280]',
    valor: 'text-muted',
  },
}

export default function PanelPage() {
  const { role, roleLabel, nombreUsuario, tenant } = useSettings()
  const { usuario } = useAuth()
  const {
    eventos,
    datosLedger,
    datosLedgerLoading,
    datosLedgerError,
    datosLedgerAccessDenied,
    limpiarEventos,
    refreshDatosLedger,
  } = useAppStore()

  const [pendientesCount, setPendientesCount] = useState<number | null>(null)
  const [pendientesError, setPendientesError] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  const nombreMostrar =
    nombreUsuario.trim() || usuario?.nombreCompleto?.trim() || usuario?.usuario?.trim() || 'Usuario'
  const tenantMostrar = etiquetaOrganizacion(tenant) || 'Tenant actual'
  const rolMostrar = roleLabel || 'Rol actual'

  const ultimos = useMemo(
    () =>
      [...datosLedger]
        .sort((a, b) => new Date(b.fechaAlta).getTime() - new Date(a.fechaAlta).getTime())
        .slice(0, 8),
    [datosLedger],
  )
  const actividad = eventos.slice(0, 8)

  const conexion = useMemo(
    () => resolverConexion(datosLedgerLoading, datosLedgerAccessDenied, datosLedgerError),
    [datosLedgerLoading, datosLedgerAccessDenied, datosLedgerError],
  )
  const estilos = tonoClases[conexion.tono]

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

  useEffect(() => {
    void cargarPendientes()
  }, [cargarPendientes])

  const onActualizar = async () => {
    setRefrescando(true)
    try {
      await refreshDatosLedger()
      await cargarPendientes()
    } finally {
      setRefrescando(false)
    }
  }

  const accesos = accesosPorRol(role)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">Panel de la Consola Cliente</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
            Bienvenido/a, <span className="font-medium text-ink">{nombreMostrar}</span>. Estás trabajando en el
            tenant <span className="font-medium text-ink">{tenantMostrar}</span> con rol{' '}
            <span className="font-medium text-ink">{rolMostrar}</span>.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary shrink-0"
          onClick={() => void onActualizar()}
          disabled={refrescando || datosLedgerLoading}
        >
          {refrescando || datosLedgerLoading ? 'Actualizando…' : 'Actualizar datos'}
        </button>
      </header>

      <section className="admin-card p-5">
        <h2 className="admin-card-title">Tu rol en Nexum</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{descripcionRol(role)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {accesos.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-accent/30 hover:bg-accent-soft hover:text-accent"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResumenCard
          label="Datos registrados"
          value={datosLedgerLoading ? '…' : datosLedger.length.toLocaleString('es-PE')}
          hint="Registros disponibles en la red del tenant."
        />
        <ResumenCard
          label="Solicitudes pendientes"
          value={pendientesError ? '—' : pendientesCount === null ? '…' : pendientesCount.toLocaleString('es-PE')}
          hint={
            pendientesError
              ? 'No se pudieron cargar las solicitudes pendientes.'
              : 'Cambios propuestos en espera de aprobación.'
          }
        />
        <ResumenCard
          label="Conexión Nexum"
          value={conexion.valor}
          hint={conexion.hint}
          valueClassName={estilos.valor}
        />
        <ResumenCard
          label="Eventos en esta sesión"
          value={eventos.length.toLocaleString('es-PE')}
          hint="Solo acciones registradas en este navegador."
        />
      </div>

      {datosLedgerAccessDenied ? (
        <div className="admin-alert-warning">
          <p>
            {datosLedgerError?.trim()
              ? datosLedgerError
              : 'Tu sesión no tiene permiso para listar datos. Revisa tu rol en Perfil y permisos.'}
          </p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/app/credenciales">
            Ir a Perfil y permisos
          </Link>
        </div>
      ) : null}

      <div className={`rounded-2xl border px-4 py-3 shadow-sm sm:px-5 ${estilos.borde}`}>
        <span className={`flex min-w-0 items-center gap-2 text-xs font-medium ${estilos.texto}`}>
          <span className="relative flex h-2 w-2 shrink-0">
            {conexion.pulso ? (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${estilos.pulso}`}
              />
            ) : null}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${estilos.punto}`} />
          </span>
          {conexion.mensaje}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
        <div className="admin-card flex min-h-[320px] min-w-0 flex-col overflow-hidden xl:min-h-0">
          <div className="admin-card-header">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="admin-card-title">Últimos datos registrados</h2>
                <p className="mt-1 text-xs text-muted">Vista compacta de los registros más recientes del tenant.</p>
              </div>
              <Link
                to="/app/datos-registrados"
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-gray-50"
              >
                Ver todos los datos
              </Link>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {datosLedgerError && !datosLedgerAccessDenied ? (
              <p className="px-4 py-6 text-center text-sm text-danger/90">{datosLedgerError}</p>
            ) : null}
            {!datosLedgerLoading && datosLedgerAccessDenied ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No se pudieron cargar los datos en esta vista.</p>
            ) : null}
            {!datosLedgerLoading && !datosLedgerError && ultimos.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No hay registros en la red del tenant todavía.</p>
            ) : null}
            {datosLedgerLoading ? <p className="px-4 py-8 text-center text-sm text-muted">Cargando…</p> : null}
            {ultimos.length > 0 ? (
              <table className="admin-table w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Dato ID</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ultimos.map((c) => (
                    <UltimaFilaDato key={c.clienteId} c={c} />
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>

        <ActivityFeed
          items={actividad}
          title="Actividad reciente de esta sesión"
          subtitle="Acciones registradas solo en este navegador. No representa el historial completo del tenant."
          emptyText="No hay actividad registrada en esta sesión todavía."
          historialLinkLabel="Ver historial local de sesión"
          className="min-h-[280px] xl:min-h-0 xl:flex-1"
          bodyClassName="min-h-0"
          onClear={limpiarEventos}
        />
      </div>
    </div>
  )
}

function ResumenCard({
  label,
  value,
  hint,
  valueClassName = 'text-ink',
}: {
  label: string
  value: string
  hint: string
  valueClassName?: string
}) {
  return (
    <div className="admin-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${valueClassName}`}>{value}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  )
}

function UltimaFilaDato({ c }: { c: ClienteApi }) {
  return (
    <tr>
      <td className="px-4 py-2.5">
        <Link
          to="/app/datos-registrados"
          state={{ focusId: c.clienteId }}
          className="font-mono text-xs font-medium text-accent hover:text-accent-hover"
        >
          {c.clienteId}
        </Link>
      </td>
      <td className="max-w-[140px] truncate px-4 py-2.5 text-muted">{c.tipoDocumento || '—'}</td>
      <td className="px-4 py-2.5">
        <ClienteLedgerEstadoBadge c={c} raw />
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{formatShortDate(c.fechaAlta)}</td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-x-2 text-[11px]">
          <Link className="text-muted hover:text-accent" to="/app/consultas" state={{ datoId: c.clienteId }}>
            Detalle
          </Link>
          <span className="text-line">·</span>
          <Link className="text-muted hover:text-accent" to={`/app/historial-dato/${encodeURIComponent(c.clienteId)}`}>
            Historial
          </Link>
          <span className="text-line">·</span>
          <Link className="text-muted hover:text-accent" to="/app/auditoria" state={{ recursoId: c.clienteId }}>
            Auditar
          </Link>
        </div>
      </td>
    </tr>
  )
}

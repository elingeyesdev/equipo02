import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/ActivityFeed'
import { StatSummary } from '../components/StatSummary'
import { useAppStore } from '../context/AppStoreContext'
import { formatShortDate } from '../lib/format'
import type { ClienteApi } from '../types/api'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'

export default function PanelPage() {
  const { eventos, datosLedger, datosLedgerLoading, datosLedgerError, datosLedgerAccessDenied, limpiarEventos } =
    useAppStore()
  const consultasCount = eventos.filter((e) => e.tipo === 'consulta').length
  const ultimos = [...datosLedger]
    .sort((a, b) => new Date(b.fechaAlta).getTime() - new Date(a.fechaAlta).getTime())
    .slice(0, 8)
  const actividad = eventos.slice(0, 8)

  const conexion = (() => {
    if (datosLedgerLoading) {
      return { tono: 'neutral' as const, mensaje: 'Verificando conexión con el puente…', pulso: false }
    }
    if (datosLedgerAccessDenied) {
      return {
        tono: 'warn' as const,
        mensaje: 'Conectado, pero tu sesión no puede listar datos en este momento.',
        pulso: false,
      }
    }
    if (datosLedgerError) {
      return {
        tono: 'error' as const,
        mensaje: 'No se pudo conectar con el middleware. Comprueba que el servicio esté en ejecución.',
        pulso: false,
      }
    }
    return {
      tono: 'ok' as const,
      mensaje: 'Conectado correctamente · datos de tu organización disponibles en la red.',
      pulso: true,
    }
  })()

  const tonoClases = {
    ok: {
      borde: 'border-emerald-200/80 bg-emerald-50/60',
      punto: 'bg-emerald-500',
      pulso: 'bg-emerald-400/40',
      texto: 'text-emerald-800',
    },
    warn: {
      borde: 'border-amber-200/80 bg-amber-50/60',
      punto: 'bg-amber-500',
      pulso: 'bg-amber-400/40',
      texto: 'text-amber-900',
    },
    error: {
      borde: 'border-red-200/80 bg-red-50/60',
      punto: 'bg-red-500',
      pulso: 'bg-red-400/40',
      texto: 'text-red-800',
    },
    neutral: {
      borde: 'border-line/60 bg-[#f9fafb]',
      punto: 'bg-gray-400',
      pulso: 'bg-gray-300/50',
      texto: 'text-[#6b7280]',
    },
  }[conexion.tono]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <StatSummary
        totalClientesEnRed={datosLedger.length}
        entityLabel="Datos en red"
        ledgerEndpointHint="Datos del ledger vía GET /datos"
        consultasCount={consultasCount}
        eventosCount={eventos.length}
        showTokenCard={false}
        dataSourceLabel="API / red"
      />

      {datosLedgerAccessDenied ? (
        <div className="admin-alert-warning">
          <p>
            {datosLedgerError?.trim()
              ? datosLedgerError
              : 'La sesión actual no tiene permiso para listar datos. Verifique con un administrador.'}
          </p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/app/credenciales">
            Ver perfil de sesión
          </Link>
        </div>
      ) : null}

      <div className={`rounded-2xl border px-4 py-3 shadow-sm sm:px-5 ${tonoClases.borde}`}>
        <span className={`flex min-w-0 items-center gap-2 text-xs font-medium ${tonoClases.texto}`}>
          <span className="relative flex h-2 w-2 shrink-0">
            {conexion.pulso ? (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${tonoClases.pulso}`} />
            ) : null}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${tonoClases.punto}`} />
          </span>
          {conexion.mensaje}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
        <div className="admin-card flex min-h-[320px] min-w-0 flex-col overflow-hidden xl:min-h-0">
          <div className="admin-card-header">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="admin-card-title">Datos en red</h2>
                <p className="mt-1 text-xs text-muted">Últimos activos · GET /datos</p>
              </div>
              <Link
                to="/app/datos-registrados"
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-gray-50"
              >
                Ver todos
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
              <p className="px-4 py-8 text-center text-sm text-muted">No hay datos en red todavía.</p>
            ) : null}
            {datosLedgerLoading ? <p className="px-4 py-8 text-center text-sm text-muted">Cargando…</p> : null}
            {ultimos.length > 0 ? (
              <table className="admin-table w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">datoId</th>
                    <th className="px-4 py-2.5 font-medium">Resumen</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">tipo</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                    <th className="px-4 py-2.5 font-medium">Alta</th>
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
          title="Actividad reciente"
          subtitle="Operaciones registradas en esta sesión"
          emptyText="No hay actividad reciente."
          className="min-h-[280px] xl:min-h-0 xl:flex-1"
          bodyClassName="min-h-0"
          onClear={limpiarEventos}
        />
      </div>
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
        <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
          <Link className="text-muted hover:text-accent" to={`/app/historial-dato/${encodeURIComponent(c.clienteId)}`}>
            Historial
          </Link>
          <span className="text-line">·</span>
          <Link className="text-muted hover:text-accent" to="/app/consultas" state={{ datoId: c.clienteId }}>
            Detalle
          </Link>
          <span className="text-line">·</span>
          <Link className="text-muted hover:text-accent" to="/app/auditoria" state={{ recursoId: c.clienteId }}>
            Auditar
          </Link>
        </div>
      </td>
      <td className="max-w-[160px] truncate px-4 py-2.5 text-muted">{c.nombre}</td>
      <td className="hidden max-w-[120px] truncate px-4 py-2.5 text-muted md:table-cell">{c.tipoDocumento}</td>
      <td className="px-4 py-2.5">
        <ClienteLedgerEstadoBadge c={c} raw />
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{formatShortDate(c.fechaAlta)}</td>
    </tr>
  )
}

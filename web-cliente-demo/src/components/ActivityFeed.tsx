import { Link } from 'react-router-dom'
import type { DemoEvent, DemoEventType } from '../types/demo'
import { formatDemoDateTime } from '../lib/format'

function tipoOperacionLabel(t: DemoEventType): string {
  const m: Record<DemoEventType, string> = {
    registro_creado: 'Alta de cliente',
    registro_editado: 'Actualización de cliente',
    registro_eliminado: 'Baja lógica (vista)',
    token_emitido: 'Emisión de token',
    token_transferido: 'Transferencia de token',
    consulta: 'Consulta',
  }
  return m[t]
}

function looksLikeFabricTxId(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s.trim())
}

interface ActivityFeedProps {
  items: DemoEvent[]
  title?: string
  subtitle?: string
  emptyText?: string
  showHistorialLink?: boolean
  className?: string
  bodyClassName?: string
  /** Si se pasa, muestra un botón para limpiar la actividad. */
  onClear?: () => void
}

export function ActivityFeed({
  items,
  title = 'Actividad reciente',
  subtitle = 'Datos obtenidos desde la red/API o acciones en esta ventana',
  emptyText = 'No hay actividades recientes.',
  showHistorialLink = true,
  className = '',
  bodyClassName = '',
  onClear,
}: ActivityFeedProps) {
  return (
    <div className={`admin-card flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div className="admin-card-header flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="admin-card-title">{title}</h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            disabled={items.length === 0}
            className="admin-btn-secondary shrink-0 px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
            title="Borrar la actividad reciente de esta sesión"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((a) => {
              const ok = a.estado === 'exito'
              const ref = a.referencia?.trim() ?? ''
              const txId = ref && looksLikeFabricTxId(ref) ? ref : null
              const refShort =
                ref && !txId ? `${ref.slice(0, 10)}…${ref.slice(-6)}` : null
              return (
                <li key={a.id} className="px-4 py-2.5 hover:bg-gray-50/80">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs text-muted">
                      <span className="text-ink-secondary">{tipoOperacionLabel(a.tipo)}</span>
                      <span className="text-line"> · </span>
                      <span>{formatDemoDateTime(a.fechaIso)}</span>
                    </p>
                    <span
                      className={`shrink-0 text-xs font-medium ${ok ? 'text-success' : 'text-danger'}`}
                    >
                      {ok ? 'Éxito' : 'Error'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink">{a.titulo}</p>
                  {a.mensaje ? <p className="mt-0.5 text-xs text-muted">{a.mensaje}</p> : null}
                  {refShort ? (
                    <p className="mt-1 font-mono text-[11px] text-muted" title={ref}>
                      {refShort}
                    </p>
                  ) : null}
                  {txId ? (
                    <p className="mt-1 break-all font-mono text-[11px] text-muted" title={txId}>
                      TXID: {txId}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {showHistorialLink ? (
        <div className="shrink-0 border-t border-line p-3 sm:px-4">
          <Link
            to="/app/historial"
            className="admin-btn-secondary block w-full py-2 text-center text-xs"
          >
            Ver historial completo
          </Link>
        </div>
      ) : null}
    </div>
  )
}

import { Link } from 'react-router-dom'
import type { AvisoRestaurar } from '../lib/restaurarRevisionUi'

type Props = {
  aviso: AvisoRestaurar
  datoId?: string
  onCerrar?: () => void
  className?: string
}

export default function RestaurarRevisionAviso({ aviso, datoId, onCerrar, className = '' }: Props) {
  if (aviso.tipo === 'pendiente') {
    return (
      <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`} role="status">
        <p className="mb-2">
          Solicitud de restauración enviada. Quedó pendiente de aprobación del administrador.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/solicitudes" className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800">
            Ver cola de aprobación
          </Link>
          {onCerrar ? (
            <button type="button" onClick={onCerrar} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100">
              Cerrar
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ${className}`} role="status">
      <p className="mb-2">Revisión restaurada correctamente como un nuevo bloque en la cadena.</p>
      {aviso.txId ? (
        <p className="mb-2 font-mono text-xs text-emerald-800">Tx: {aviso.txId.slice(0, 20)}…</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {datoId ? (
          <Link
            to={`/app/historial-dato/${encodeURIComponent(datoId)}`}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            Ver historial en cadena
          </Link>
        ) : null}
        {onCerrar ? (
          <button type="button" onClick={onCerrar} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs text-emerald-900 hover:bg-emerald-100">
            Cerrar
          </button>
        ) : null}
      </div>
    </div>
  )
}

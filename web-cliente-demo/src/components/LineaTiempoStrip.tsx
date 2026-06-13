import { formatDemoDateTime } from '../lib/format'
import { estiloAccionLineaTiempo, iconoAccionLineaTiempo } from '../lib/lineaTiempoAcciones'
import type { AccionLineaTiempo } from '../services/apiHistorialCliente'

type Props = {
  registroId: string
  acciones: AccionLineaTiempo[]
  selectedIdx?: number | null
  onSelect?: (idx: number | null) => void
  compact?: boolean
  loading?: boolean
  error?: string | null
  onClose?: () => void
}

function FlechaRecorrido() {
  return (
    <span
      className="mx-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent/60"
      aria-hidden
    >
      <svg className="h-2 w-2" viewBox="0 0 8 8" fill="none">
        <path
          d="M1.75 1.5L5.25 4 1.75 6.5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export default function LineaTiempoStrip({
  registroId,
  acciones,
  selectedIdx = null,
  onSelect,
  compact = false,
  loading = false,
  error = null,
  onClose,
}: Props) {
  if (loading) {
    return <p className="py-2 text-xs text-muted">Cargando línea de tiempo…</p>
  }
  if (error) {
    return <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-ink">{error}</p>
  }
  if (acciones.length === 0) {
    return <p className="py-2 text-xs text-muted italic">Sin acciones en el historial.</p>
  }

  return (
    <div className={compact ? 'py-2' : 'py-3'}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Línea de tiempo · <span className="font-mono text-ink-secondary">{registroId}</span>
          <span className="ml-1 font-normal normal-case">({acciones.length})</span>
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-2 py-0.5 text-[10px] font-medium text-muted hover:bg-gray-100 hover:text-ink-secondary"
          >
            Ocultar
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-0.5 overflow-x-auto pb-1">
        {acciones.map((acc, i) => {
          const estilo = estiloAccionLineaTiempo(acc.tipo)
          const isSelected = selectedIdx === i
          return (
            <div key={`${acc.txId}-${i}`} className="flex items-center">
              {i > 0 ? <FlechaRecorrido /> : null}
              <button
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(isSelected ? null : i)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                  isSelected ? `${estilo.chip} ring-1 ring-current/25` : `${estilo.chip} hover:opacity-90`
                } ${onSelect ? 'cursor-pointer' : 'cursor-default'} ${compact ? 'min-w-[120px]' : 'min-w-[140px]'}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] ${estilo.icon}`}>
                  {iconoAccionLineaTiempo(acc.tipo)}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[10px] font-bold uppercase leading-tight ${estilo.text}`}>{acc.etiqueta}</span>
                  <span className="block text-[9px] text-muted">{formatDemoDateTime(acc.fecha)}</span>
                  {acc.restauradoDesdeTxId ? (
                    <span className="block text-[8px] text-amber-600">↩ {acc.restauradoDesdeTxId.slice(0, 10)}…</span>
                  ) : null}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

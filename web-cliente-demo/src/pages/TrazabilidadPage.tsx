import { useMemo, useState } from 'react'
import { useAppStore } from '../context/AppStoreContext'
import { roleLabel } from '../lib/roles'
import { formatDemoDateTime } from '../lib/format'
import { etiquetaTokenDemo } from '../lib/tokenDemoLabel'
import type { TraceEntry, TraceOperationType } from '../types/demo'

// Filtros para trazabilidad. La consola es audit-only y no maneja tokens.
const filtrosBase: { id: TraceOperationType | 'all'; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'CLIENTE_REGISTRADO', label: 'Registro creado' },
  { id: 'CLIENTE_CONSULTADO', label: 'Registro consultado' },
  { id: 'ERROR_PERMISOS', label: 'Errores de permisos' },
  { id: 'ERROR_API', label: 'Errores API' },
]

function filtrosTrazabilidad(): typeof filtrosBase {
  return filtrosBase
}

function traceTipoLabel(t: TraceOperationType): string {
  const hit = filtrosBase.find((f) => f.id === t)
  return hit?.label ?? t
}

function traceEstadoLabel(state: TraceEntry['state']): string {
  if (state === 'exitoso') return 'ÉXITO'
  if (state === 'error') return 'ERROR'
  if (state === 'bloqueado') return 'BLOQUEADO'
  if (state === 'pendiente') return 'PENDIENTE'
  return state
}

export default function TrazabilidadPage() {
  const { traces, showToast } = useAppStore()
  const [tipo, setTipo] = useState<TraceOperationType | 'all'>('all')

  const list = useMemo(() => {
    if (tipo === 'all') return traces
    return traces.filter((t) => t.operationType === tipo)
  }, [traces, tipo])

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showToast(`${label} copiado.`, 'success')
    } catch {
      showToast('No se pudo copiar.', 'error')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 admin-card p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-semibold text-ink">Trazabilidad de operaciones</h2>
        <p className="mt-1 text-xs text-muted">
          Cada operación muestra su recorrido: captura, validación de rol, envío a API y respuesta (con TXID cuando
          aplica). Puedes copiar txId/txIdMint para validarlo manualmente en Hyperledger Explorer.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {filtrosTrazabilidad().map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTipo(f.id)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                tipo === f.id
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : 'border-line bg-gray-50 text-muted hover:border-accent-soft/40 hover:text-ink-secondary',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {list.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-gray-50 p-8 text-center text-sm text-muted">
            Aún no hay trazas registradas con este filtro.
          </div>
        ) : null}
        {list.map((t) => (
          <TraceCard key={t.id} trace={t} onCopy={copy} />
        ))}
      </div>
    </div>
  )
}

function TraceCard({
  trace,
  onCopy,
}: {
  trace: TraceEntry
  onCopy: (value: string, label: string) => Promise<void>
}) {
  return (
    <article className="admin-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{traceTipoLabel(trace.operationType)}</p>
          <p className="mt-1 text-xs text-muted">{trace.message}</p>
        </div>
        <span className={badgeState(trace.state)}>{traceEstadoLabel(trace.state)}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <Meta k="ID traza" v={trace.id} mono />
        <Meta k="Fecha" v={formatDemoDateTime(trace.createdAt)} />
        <Meta k="Modo" v={trace.mode === 'api' ? 'Red / API' : 'Navegador (sin API)'} />
        <Meta k="Rol" v={roleLabel(trace.role)} />
        {trace.clienteId ? <Meta k="ID" v={trace.clienteId} mono /> : null}
        {trace.codigoToken ? (
          <Meta k="TOKEN" v={etiquetaTokenDemo(trace.codigoToken)} mono />
        ) : null}
        {trace.httpStatus ? <Meta k="HTTP" v={String(trace.httpStatus)} mono /> : null}
        {trace.errorCode ? <Meta k="codigo error" v={trace.errorCode} mono /> : null}
        {trace.errorMessage ? <Meta k="mensaje error" v={trace.errorMessage} /> : null}
      </dl>

      <ol className="mt-4 space-y-2">
        {trace.steps.map((s, idx) => (
          <li key={s.id} className="flex items-start gap-2 text-xs">
            <span className={stepDot(s.status)}>{idx + 1}</span>
            <div>
              <p className="font-medium text-ink-secondary">{s.label}</p>
              {s.detail ? <p className="text-muted">{s.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {trace.txId || trace.txIdMint ? (
        <div className="mt-4 rounded-xl border border-line bg-gray-50 p-3">
          {trace.txId ? (
            <div className="mb-2">
              <p className="text-[11px] uppercase text-muted">txId</p>
              <p className="break-all font-mono text-xs text-ink-secondary">{trace.txId}</p>
              <button className="mt-1 text-xs text-accent hover:text-accent-hover" onClick={() => void onCopy(trace.txId!, 'txId')}>
                Copiar TXID
              </button>
            </div>
          ) : null}
          {trace.txIdMint ? (
            <div>
              <p className="text-[11px] uppercase text-muted">txIdMint</p>
              <p className="break-all font-mono text-xs text-muted">{trace.txIdMint}</p>
              <button
                className="mt-1 text-xs text-accent hover:text-accent-hover"
                onClick={() => void onCopy(trace.txIdMint!, 'txIdMint')}
              >
                Copiar txIdMint
              </button>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-muted">
            Copia este TXID y buscalo en Hyperledger Explorer como Txn Hash para comprobar la transaccion.
          </p>
        </div>
      ) : null}
    </article>
  )
}

function Meta({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-muted">{k}</dt>
      <dd className={`mt-0.5 text-ink-secondary ${mono ? 'font-mono' : ''}`}>{v}</dd>
    </div>
  )
}

function badgeState(state: TraceEntry['state']): string {
  const base = 'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
  if (state === 'exitoso') return `${base} border-success/30 bg-success/15 text-success`
  if (state === 'error') return `${base} border-danger/40 bg-danger/15 text-danger`
  if (state === 'bloqueado') return `${base} border-amber-500/35 bg-amber-500/10 text-amber-200`
  return `${base} border-line bg-surface text-ink-secondary`
}

function stepDot(state: TraceEntry['state']): string {
  const base = 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold'
  if (state === 'exitoso') return `${base} bg-success/20 text-success`
  if (state === 'error') return `${base} bg-danger/20 text-danger`
  if (state === 'bloqueado') return `${base} bg-amber-500/20 text-amber-200`
  return `${base} bg-surface text-ink-secondary`
}

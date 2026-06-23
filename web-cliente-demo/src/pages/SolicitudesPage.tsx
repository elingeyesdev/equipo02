import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { roleFromBackend } from '../lib/roles'
import {
  aprobarSolicitud,
  listarSolicitudes,
  rechazarSolicitud,
  type EstadoSolicitud,
  type Solicitud,
} from '../services/apiSolicitudes'

const FILTROS: { key: EstadoSolicitud | 'todas'; label: string }[] = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobada', label: 'Aprobadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'todas', label: 'Todas' },
]

const OP_LABEL: Record<Solicitud['operacion'], string> = {
  crear: 'Alta',
  actualizar: 'Edición',
  eliminar: 'Baja',
  restaurar: 'Restauración',
}

function badgeEstado(estado: EstadoSolicitud): string {
  if (estado === 'pendiente') return 'bg-amber-100 text-amber-800 border border-amber-200'
  if (estado === 'aprobada') return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  return 'bg-rose-100 text-rose-800 border border-rose-200'
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function payloadPreview(payload: unknown): string {
  if (payload === undefined || payload === null) return '—'
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

export default function SolicitudesPage() {
  const { usuario } = useAuth()
  const rol = roleFromBackend(usuario?.rol)
  const esAdmin = rol === 'admin'

  const [filtro, setFiltro] = useState<EstadoSolicitud | 'todas'>('pendiente')
  const [items, setItems] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const estado = filtro === 'todas' ? undefined : filtro
      const data = await listarSolicitudes(estado)
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes')
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    // El integrador ve principalmente las suyas; el admin ve todas las del tenant.
    if (esAdmin) return items
    const yo = (usuario?.usuario ?? '').toLowerCase()
    return items.filter((s) => s.solicitante.toLowerCase() === yo)
  }, [items, esAdmin, usuario])

  async function onAprobar(s: Solicitud) {
    setAccionEnCurso(s.id)
    setAviso(null)
    setError(null)
    try {
      const r = await aprobarSolicitud(s.id)
      setAviso(`Solicitud ${s.id} aprobada y confirmada en la cadena${r.txId ? ` (tx ${r.txId.slice(0, 12)}…)` : ''}.`)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aprobar la solicitud')
    } finally {
      setAccionEnCurso(null)
    }
  }

  async function onRechazar(s: Solicitud) {
    const motivo = window.prompt('Motivo del rechazo (opcional):', '') ?? ''
    setAccionEnCurso(s.id)
    setAviso(null)
    setError(null)
    try {
      await rechazarSolicitud(s.id, motivo)
      setAviso(`Solicitud ${s.id} rechazada. No se escribió nada en la cadena.`)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo rechazar la solicitud')
    } finally {
      setAccionEnCurso(null)
    }
  }

  const esLectura = rol === 'solo_lectura'

  const introRol =
    esAdmin
      ? 'Como administrador, puedes aprobar o rechazar cambios propuestos por integradores (altas, ediciones, bajas y restauraciones).'
      : esLectura
        ? 'Tu rol puede consultar información, pero no aprobar cambios.'
        : 'Aquí puedes ver el estado de los cambios que propusiste, incluidas solicitudes de restauración.'

  return (
    <div className="space-y-5">
      <div className="alert alert-info" role="status">
        <h2 className="alert-heading h5 mb-2">Cola de aprobación</h2>
        <p className="mb-2">
          Esta pantalla muestra solicitudes de cambio de datos dentro del tenant. No son solicitudes de
          integración BaaS. Las solicitudes de integración se gestionan en la Consola Operador.
        </p>
        <p className="mb-0 small">{introRol}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              filtro === f.key
                ? 'bg-accent text-white'
                : 'border border-line bg-surface text-ink-secondary hover:border-accent/30',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void cargar()}
          className="ml-auto rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-secondary hover:border-accent/30"
        >
          Actualizar
        </button>
      </div>

      {aviso ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{aviso}</div> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      {cargando ? (
        <p className="text-sm text-muted">Cargando solicitudes…</p>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          No hay solicitudes {filtro !== 'todas' ? `en estado "${filtro}"` : ''}.
        </div>
      ) : (
        <ul className="space-y-3">
          {visibles.map((s) => (
            <li key={s.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeEstado(s.estado)}`}>{s.estado}</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-ink-secondary">{OP_LABEL[s.operacion]}</span>
                <span className="text-sm font-semibold text-ink">{s.datoId}</span>
                {s.tipoDato ? <span className="text-xs text-muted">tipo: {s.tipoDato}</span> : null}
                <span className="ml-auto text-xs text-muted">{fmtFecha(s.creadaEn)}</span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-ink-secondary sm:grid-cols-2">
                <span>Solicitante: <strong>{s.solicitanteNombre || s.solicitante}</strong></span>
                <span>ID: <code className="text-[11px]">{s.id}</code></span>
                {s.operacion === 'restaurar' && s.txIdOrigen ? (
                  <span className="sm:col-span-2">Restaurar desde tx: <code className="text-[11px]">{s.txIdOrigen}</code></span>
                ) : null}
                {s.estado !== 'pendiente' ? (
                  <>
                    <span>Resuelta por: <strong>{s.resueltaPor || '—'}</strong></span>
                    <span>Resuelta: {fmtFecha(s.resueltaEn)}</span>
                    {s.txIdResultado ? <span className="sm:col-span-2">Tx confirmada: <code className="text-[11px]">{s.txIdResultado}</code></span> : null}
                    {s.motivo ? <span className="sm:col-span-2">Motivo: {s.motivo}</span> : null}
                  </>
                ) : null}
              </div>

              {s.payload !== undefined && s.payload !== null ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-accent">Ver payload propuesto</summary>
                  <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{payloadPreview(s.payload)}</pre>
                </details>
              ) : null}

              {esAdmin && s.estado === 'pendiente' ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={accionEnCurso === s.id}
                    onClick={() => void onAprobar(s)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {accionEnCurso === s.id ? 'Procesando…' : 'Aprobar y confirmar en cadena'}
                  </button>
                  <button
                    type="button"
                    disabled={accionEnCurso === s.id}
                    onClick={() => void onRechazar(s)}
                    className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

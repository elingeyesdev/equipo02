import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { roleFromBackend } from '../lib/roles'
import {
  actualizarDatoApi,
  crearDatoApi,
  eliminarDatoApi,
  listarDatosApi,
  type RespuestaMutacionDato,
} from '../services/apiDatos'

interface FilaDato {
  datoId: string
  tipo: string
  payload: unknown
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

// Normaliza una fila del ledger (dato_cc) a {datoId, tipo, payload} de forma
// agnóstica al dominio.
function normalizarFila(row: unknown): FilaDato | null {
  const o = asObj(row)
  const datoId = String(o.datoId ?? o.id ?? o.ID ?? '').trim()
  if (!datoId) return null
  const tipo = String(o.tipo ?? o.Tipo ?? '').trim()
  let payload: unknown = o.payload ?? o.payloadDecodificado ?? o.Payload ?? null
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      /* dejar string crudo */
    }
  }
  return { datoId, tipo, payload }
}

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

export default function DatosPage() {
  const { usuario } = useAuth()
  const rol = roleFromBackend(usuario?.rol)
  const puedeEscribir = rol === 'admin' || rol === 'integrador'
  const esIntegrador = rol === 'integrador'

  const [filas, setFilas] = useState<FilaDato[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [editando, setEditando] = useState(false)
  const [datoId, setDatoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [payloadText, setPayloadText] = useState('{\n  \n}')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await listarDatosApi()
      const arr = Array.isArray(r.datos) ? r.datos : []
      setFilas(arr.map(normalizarFila).filter((x): x is FilaDato => x !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  function limpiarForm() {
    setEditando(false)
    setDatoId('')
    setTipo('')
    setPayloadText('{\n  \n}')
  }

  function cargarEnForm(f: FilaDato) {
    setEditando(true)
    setDatoId(f.datoId)
    setTipo(f.tipo)
    setPayloadText(JSON.stringify(f.payload ?? {}, null, 2))
  }

  function mensajeResultado(r: RespuestaMutacionDato, accion: string): string {
    if (r.estado === 'pendiente') {
      return `${accion} enviada. Quedó PENDIENTE de aprobación del administrador (solicitud ${r.solicitudId ?? ''}).`
    }
    return `${accion} confirmada en la Blockchain${r.txId ? ` (tx ${r.txId.slice(0, 12)}…)` : ''}.`
  }

  async function onGuardar() {
    setAviso(null)
    setError(null)
    const id = datoId.trim()
    const t = tipo.trim()
    if (!id || !t) {
      setError('datoId y tipo son obligatorios.')
      return
    }
    let payload: unknown
    try {
      payload = JSON.parse(payloadText)
    } catch {
      setError('El payload no es JSON válido.')
      return
    }
    setEnviando(true)
    try {
      const r = editando
        ? await actualizarDatoApi({ datoId: id, tipo: t, payload })
        : await crearDatoApi({ datoId: id, tipo: t, payload })
      setAviso(mensajeResultado(r, editando ? 'Edición' : 'Alta'))
      limpiarForm()
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el dato')
    } finally {
      setEnviando(false)
    }
  }

  async function onEliminar(f: FilaDato) {
    if (!window.confirm(`¿Dar de baja "${f.datoId}"?`)) return
    setAviso(null)
    setError(null)
    try {
      const r = await eliminarDatoApi(f.datoId)
      setAviso(mensajeResultado(r, 'Baja'))
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el dato')
    }
  }

  const total = useMemo(() => filas.length, [filas])

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Datos en la red</h1>
        <p className="text-sm text-ink-secondary">
          Modelo universal: cualquier activo se representa como datoId + tipo + payload JSON.
          {esIntegrador ? ' Como integrador, tus cambios quedan pendientes de aprobación del administrador.' : ''}
        </p>
      </header>

      {aviso ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{aviso}</div> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      {puedeEscribir ? (
        <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">{editando ? 'Editar dato' : 'Nuevo dato'}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-secondary">datoId</span>
              <input className={input} value={datoId} disabled={editando} onChange={(e) => setDatoId(e.target.value)} placeholder="EXP-001" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-secondary">tipo</span>
              <input className={input} value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="expediente" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-ink-secondary">payload (JSON)</span>
            <textarea
              className={`${input} font-mono`}
              rows={8}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={() => void onGuardar()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : editando ? 'Guardar cambios' : 'Registrar dato'}
            </button>
            {editando ? (
              <button type="button" onClick={limpiarForm} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink-secondary">
                Cancelar
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          Tu perfil es de solo lectura: puedes consultar los datos pero no modificarlos.
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Registros ({total})</h2>
          <button type="button" onClick={() => void cargar()} className="rounded-lg border border-line px-3 py-1 text-xs text-ink-secondary hover:border-accent/30">
            Actualizar
          </button>
        </div>
        {cargando ? (
          <p className="px-4 py-6 text-sm text-muted">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No hay datos registrados en este tenant.</p>
        ) : (
          <ul className="divide-y divide-line">
            {filas.map((f) => (
              <li key={f.datoId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-semibold text-ink">{f.datoId}</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-ink-secondary">{f.tipo || '—'}</span>
                <details className="basis-full">
                  <summary className="cursor-pointer text-xs text-accent">Ver payload</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] text-gray-100">{JSON.stringify(f.payload ?? {}, null, 2)}</pre>
                </details>
                {puedeEscribir ? (
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => cargarEnForm(f)} className="rounded-lg border border-line px-3 py-1 text-xs text-ink-secondary hover:border-accent/30">
                      Editar
                    </button>
                    <button type="button" onClick={() => void onEliminar(f)} className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50">
                      Baja
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

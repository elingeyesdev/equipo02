import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleFromBackend } from '../lib/roles'
import { formatShortDate } from '../lib/format'
import {
  actualizarDatoApi,
  eliminarDatoApi,
  listarDatosApi,
  type RespuestaMutacionDato,
} from '../services/apiDatos'
import type { AppRole } from '../types/demo'

interface FilaDato {
  datoId: string
  tipo: string
  payload: unknown
  estado: string
  fecha: string
}

type AvisoExito =
  | { tipo: 'pendiente' }
  | { tipo: 'confirmado'; datoId: string; txId?: string }

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function extraerEstado(payload: unknown, tipo: string): string {
  const p = asObj(payload)
  const estado = String(p.estado ?? '').trim()
  if (estado) return estado
  return tipo.trim() || '—'
}

function extraerFecha(row: Record<string, unknown>, payload: unknown): string {
  const p = asObj(payload)
  return String(
    row.fechaActualizacion ?? row.fechaCreacion ?? p.fechacreacion ?? p.fechaCreacion ?? p.fecha ?? '',
  ).trim()
}

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
  return {
    datoId,
    tipo,
    payload,
    estado: extraerEstado(payload, tipo),
    fecha: extraerFecha(o, payload),
  }
}

function tituloRolCard(rol: AppRole): string {
  if (rol === 'admin') return 'Rol administrador'
  if (rol === 'integrador') return 'Rol integrador'
  return 'Rol solo lectura'
}

function textoRolCard(rol: AppRole): string {
  if (rol === 'admin') {
    return 'Como administrador, puedes actualizar o dar de baja registros existentes directamente en blockchain.'
  }
  if (rol === 'integrador') {
    return 'Como integrador, puedes proponer cambios sobre registros existentes. Un administrador deberá aprobarlos desde la Cola de aprobación.'
  }
  return 'Tu rol permite consultar información, pero no modificar registros.'
}

function etiquetaGuardar(rol: AppRole): string {
  if (rol === 'admin') return 'Guardar cambios en la red'
  return 'Enviar solicitud de cambio'
}

function etiquetaEliminarLista(rol: AppRole): string {
  if (rol === 'admin') return 'Dar de baja en la red'
  return 'Enviar solicitud de baja'
}

function mensajeConfirmBaja(rol: AppRole): string {
  if (rol === 'admin') {
    return '¿Dar de baja este registro en la red? Esta acción se registrará en blockchain.'
  }
  return '¿Enviar solicitud de baja? Un administrador deberá aprobarla antes de aplicarse.'
}

function resolverAvisoExito(r: RespuestaMutacionDato, datoId: string): AvisoExito {
  if (r.estado === 'pendiente') {
    return { tipo: 'pendiente' }
  }
  return { tipo: 'confirmado', datoId, txId: r.txId }
}

export default function DatosPage() {
  const { usuario } = useAuth()
  const rol = roleFromBackend(usuario?.rol)
  const puedeEscribir = rol === 'admin' || rol === 'integrador'

  const [filas, setFilas] = useState<FilaDato[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avisoExito, setAvisoExito] = useState<AvisoExito | null>(null)

  const [editando, setEditando] = useState(false)
  const [datoId, setDatoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [payloadText, setPayloadText] = useState('')
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

  const total = useMemo(() => filas.length, [filas])

  function cancelarEdicion() {
    setEditando(false)
    setDatoId('')
    setTipo('')
    setPayloadText('')
  }

  function cargarEnForm(f: FilaDato) {
    setEditando(true)
    setDatoId(f.datoId)
    setTipo(f.tipo)
    setPayloadText(JSON.stringify(f.payload ?? {}, null, 2))
    setAvisoExito(null)
    setError(null)
  }

  function onFormatearJson() {
    setError(null)
    try {
      const parsed = JSON.parse(payloadText)
      setPayloadText(JSON.stringify(parsed, null, 2))
    } catch {
      setError('El contenido del registro no es JSON válido. Corrígelo antes de formatear.')
    }
  }

  async function onGuardar() {
    if (!editando) return
    setAvisoExito(null)
    setError(null)
    const id = datoId.trim()
    const t = tipo.trim()
    if (!id || !t) {
      setError('El ID del dato y el tipo de registro son obligatorios.')
      return
    }
    let payload: unknown
    try {
      payload = JSON.parse(payloadText)
    } catch {
      setError('El contenido del registro no es JSON válido.')
      return
    }
    setEnviando(true)
    try {
      const r = await actualizarDatoApi({ datoId: id, tipo: t, payload })
      setAvisoExito(resolverAvisoExito(r, id))
      cancelarEdicion()
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el registro')
    } finally {
      setEnviando(false)
    }
  }

  async function onEliminar(f: FilaDato) {
    if (!window.confirm(mensajeConfirmBaja(rol))) return
    setAvisoExito(null)
    setError(null)
    if (editando && datoId === f.datoId) cancelarEdicion()
    try {
      const r = await eliminarDatoApi(f.datoId)
      setAvisoExito(resolverAvisoExito(r, f.datoId))
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de baja el registro')
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Actualización manual</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
          Actualiza o da de baja registros existentes en Nexum. La creación de nuevos datos debe realizarse desde el
          sistema cliente mediante la API.
        </p>
      </header>

      <div className="alert alert-warning mb-0" role="status">
        <h2 className="alert-heading h5 mb-2">Actualización de registros existentes</h2>
        <p className="mb-0">
          Esta pantalla no crea registros nuevos. Los nuevos datos deben originarse desde el sistema cliente integrado
          mediante la API. Aquí solo puedes actualizar o dar de baja registros que ya existen en Nexum.
        </p>
      </div>

      <div className="alert alert-info mb-0" role="status">
        <h2 className="alert-heading h5 mb-2">{tituloRolCard(rol)}</h2>
        <p className="mb-0">{textoRolCard(rol)}</p>
      </div>

      {avisoExito ? <AvisoExitoPanel aviso={avisoExito} /> : null}
      {error ? (
        <div className="alert alert-danger mb-0" role="alert">
          {error}
        </div>
      ) : null}

      {!puedeEscribir ? (
        <section className="admin-card p-4 sm:p-5">
          <p className="text-sm text-ink-secondary">{textoRolCard(rol)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/app/consultas"
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-accent/30 hover:bg-accent-soft hover:text-accent"
            >
              Consultar registro
            </Link>
            <Link
              to="/app/datos-registrados"
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:border-accent/30 hover:bg-accent-soft hover:text-accent"
            >
              Ver datos registrados
            </Link>
          </div>
        </section>
      ) : null}

      <section className="admin-card overflow-hidden">
        <div className="admin-card-header flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="admin-card-title">Registros existentes ({total})</h2>
            <p className="mt-1 text-xs text-muted">
              Selecciona un registro para actualizar su contenido o darlo de baja.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            className="btn btn-sm btn-outline-secondary"
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar lista'}
          </button>
        </div>
        <div className="min-h-0 overflow-auto">
          {cargando ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Cargando…</p>
          ) : filas.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="admin-table w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ID del dato</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filas.map((f) => (
                  <tr key={f.datoId} className={editando && datoId === f.datoId ? 'bg-accent-soft/40' : undefined}>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-medium text-ink">{f.datoId}</span>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-accent">Ver contenido JSON</summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-gray-900 p-2 text-[10px] text-gray-100">
                          {JSON.stringify(f.payload ?? {}, null, 2)}
                        </pre>
                      </details>
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-2.5 text-muted">{f.tipo || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="admin-badge-neutral text-[11px]">{f.estado}</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-muted md:table-cell">
                      {f.fecha ? formatShortDate(f.fecha) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {puedeEscribir ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            onClick={() => cargarEnForm(f)}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void onEliminar(f)}
                            className="btn btn-sm btn-outline-danger"
                          >
                            {etiquetaEliminarLista(rol)}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Solo consulta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {puedeEscribir && editando ? (
        <section className="admin-card p-4 sm:p-5">
          <h2 className="admin-card-title">Editar registro</h2>
          <p className="mt-1 text-xs text-muted">
            Modifica el contenido del registro <span className="font-mono font-medium text-ink">{datoId}</span> y guarda
            los cambios.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-secondary">ID del dato</span>
              <input className={input} value={datoId} disabled readOnly />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-secondary">Tipo de registro</span>
              <input className={input} value={tipo} onChange={(e) => setTipo(e.target.value)} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-ink-secondary">Contenido del registro (JSON)</span>
            <textarea
              className={`${input} font-mono`}
              rows={10}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            El contenido debe ser un objeto JSON válido. Usa los datos reales del registro como base.
          </p>
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onFormatearJson}>
              Formatear JSON
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={enviando} onClick={() => void onGuardar()} className="btn btn-primary">
              {enviando ? 'Enviando…' : etiquetaGuardar(rol)}
            </button>
            <button type="button" onClick={cancelarEdicion} className="btn btn-outline-secondary">
              Cancelar
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-4 py-10 text-center">
      <h3 className="text-base font-semibold text-ink">No hay datos registrados</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Cuando el sistema cliente envíe datos a Nexum mediante la API, aparecerán aquí para consulta o actualización.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link to="/app/consultas" className="btn btn-sm btn-outline-primary">
          Consultar registro
        </Link>
        <Link to="/app/datos-registrados" className="btn btn-sm btn-outline-secondary">
          Ver datos registrados
        </Link>
      </div>
    </div>
  )
}

function AvisoExitoPanel({ aviso }: { aviso: AvisoExito }) {
  if (aviso.tipo === 'pendiente') {
    return (
      <div className="alert alert-success mb-0" role="status">
        <p className="mb-2">
          Solicitud enviada correctamente. Quedó pendiente de aprobación del administrador.
        </p>
        <Link to="/app/solicitudes" className="btn btn-sm btn-success">
          Ver cola de aprobación
        </Link>
      </div>
    )
  }

  return (
    <div className="alert alert-success mb-0" role="status">
      <p className="mb-2">Registro confirmado en blockchain.</p>
      {aviso.txId ? (
        <p className="mb-2 font-mono text-xs text-muted">Tx: {aviso.txId.slice(0, 16)}…</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link to="/app/consultas" state={{ datoId: aviso.datoId }} className="btn btn-sm btn-success">
          Consultar registro
        </Link>
        <Link to="/app/datos-registrados" state={{ focusId: aviso.datoId }} className="btn btn-sm btn-outline-success">
          Ver datos registrados
        </Link>
      </div>
    </div>
  )
}

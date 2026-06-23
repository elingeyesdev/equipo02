import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconFileSearch, IconPencil, IconRefresh } from '@tabler/icons-react'
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

function etiquetaGuardar(rol: AppRole): string {
  if (rol === 'admin') return 'Guardar cambios en la red'
  return 'Enviar solicitud de cambio'
}

function etiquetaEliminar(rol: AppRole): string {
  if (rol === 'admin') return 'Dar de baja en la red'
  return 'Enviar solicitud de baja'
}

function mensajeConfirmBaja(rol: AppRole): string {
  if (rol === 'admin') {
    return 'Esta acción marcará el registro seleccionado como dado de baja en la red. No se recomienda continuar si no estás seguro.'
  }
  return 'Se enviará una solicitud de baja. Un administrador deberá aprobarla antes de aplicarse en la red.'
}

function resolverAvisoExito(r: RespuestaMutacionDato, datoId: string): AvisoExito {
  if (r.estado === 'pendiente') {
    return { tipo: 'pendiente' }
  }
  return { tipo: 'confirmado', datoId, txId: r.txId }
}

function validarJson(text: string): string | null {
  if (!text.trim()) return 'El JSON no puede estar vacío.'
  try {
    JSON.parse(text)
    return null
  } catch {
    return 'El contenido del registro no es JSON válido.'
  }
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
  const [modalBaja, setModalBaja] = useState<FilaDato | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [busquedaId, setBusquedaId] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')

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

  const filasFiltradas = useMemo(() => {
    const q = busquedaAplicada.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) => f.datoId.toLowerCase().includes(q))
  }, [filas, busquedaAplicada])

  const registroSeleccionado = useMemo(
    () => (editando ? filas.find((f) => f.datoId === datoId) ?? null : null),
    [editando, datoId, filas],
  )

  const jsonError = useMemo(() => {
    if (!editando || !payloadText.trim()) return null
    return validarJson(payloadText)
  }, [editando, payloadText])

  function aplicarFiltros() {
    setBusquedaAplicada(busquedaId)
  }

  function limpiarFiltros() {
    setBusquedaId('')
    setBusquedaAplicada('')
  }

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
    const err = validarJson(payloadText)
    if (err) {
      setError(err.replace('El contenido del registro no es JSON válido.', 'El contenido del registro no es JSON válido. Corrígelo antes de formatear.'))
      return
    }
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
    const jsonErr = validarJson(payloadText)
    if (jsonErr) {
      setError(jsonErr)
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

  async function ejecutarBaja(f: FilaDato) {
    setAvisoExito(null)
    setError(null)
    if (editando && datoId === f.datoId) cancelarEdicion()
    setEliminando(true)
    try {
      const r = await eliminarDatoApi(f.datoId)
      setAvisoExito(resolverAvisoExito(r, f.datoId))
      setModalBaja(null)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de baja el registro')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="consola-datos">
      <div className="consola-notice" role="status">
        Esta pantalla no crea registros nuevos. Los nuevos datos deben originarse desde el sistema cliente integrado
        mediante la API. Aquí solo puedes actualizar o dar de baja registros existentes.
      </div>

      {avisoExito ? <AvisoExitoCompact aviso={avisoExito} /> : null}
      {error ? (
        <div className="consola-alert consola-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!puedeEscribir ? (
        <div className="consola-notice consola-notice--muted">
          Tu rol permite consultar información, pero no modificar registros.{' '}
          <Link to="/app/consultas" className="consola-link">
            Consultar registro
          </Link>
        </div>
      ) : null}

      <div className="consola-datos-layout">
        <div className="consola-datos-col-left">
          <section className="consola-panel consola-datos-search">
            <div className="consola-panel-head consola-datos-search-head">
              <h2 className="consola-panel-title">Buscar registro</h2>
            </div>
            <div className="consola-panel-body consola-datos-search-body">
              <label className="consola-field consola-datos-search-field">
                <span className="consola-field-label">ID del dato</span>
                <input
                  type="search"
                  className="consola-input"
                  placeholder="Ej. AmiLote, DIAG-POST-POLICY..."
                  value={busquedaId}
                  onChange={(e) => setBusquedaId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') aplicarFiltros()
                  }}
                />
              </label>
              <div className="consola-datos-search-actions">
                <button type="button" className="consola-btn consola-btn--primary" onClick={aplicarFiltros}>
                  Buscar
                </button>
                <button type="button" className="consola-btn consola-btn--secondary" onClick={limpiarFiltros}>
                  Limpiar
                </button>
                <button
                  type="button"
                  className="consola-refresh-btn"
                  title="Actualizar lista"
                  aria-label="Actualizar lista"
                  disabled={cargando}
                  onClick={() => void cargar()}
                >
                  <IconRefresh size={18} stroke={1.75} className={cargando ? 'animate-spin' : undefined} />
                </button>
              </div>
            </div>
          </section>

          <section className="consola-panel consola-datos-table-panel">
          <div className="consola-panel-head">
            <h2 className="consola-panel-title">Registros existentes</h2>
            <p className="consola-panel-subtitle">
              Selecciona un registro para revisar o modificar su contenido.
              {filas.length > 0 ? ` · ${filasFiltradas.length} de ${filas.length}` : ''}
            </p>
          </div>
          <div className="consola-datos-table-body">
            {cargando ? (
              <p className="consola-empty">Cargando registros…</p>
            ) : filas.length === 0 ? (
              <EmptyStateLista />
            ) : filasFiltradas.length === 0 ? (
              <p className="consola-empty">No se encontraron registros con ese ID.</p>
            ) : (
              <div className="consola-table-wrap consola-datos-table-scroll">
                <table className="consola-table consola-datos-table">
                  <thead>
                    <tr>
                      <th>ID del dato</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((f) => {
                      const seleccionado = editando && datoId === f.datoId
                      return (
                        <tr key={f.datoId} className={seleccionado ? 'consola-datos-row--selected' : undefined}>
                          <td className="font-mono text-[0.72rem]">{f.datoId}</td>
                          <td className="consola-datos-tipo">{f.tipo || '—'}</td>
                          <td>
                            <EstadoBadge estado={f.estado} />
                          </td>
                          <td className="text-[#667085]">{f.fecha ? formatShortDate(f.fecha) : '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="consola-btn consola-btn--ghost consola-btn--sm"
                              onClick={() => cargarEnForm(f)}
                            >
                              <IconPencil size={14} stroke={1.75} aria-hidden />
                              {puedeEscribir ? 'Seleccionar' : 'Ver'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        </div>

        <aside className="consola-panel consola-datos-editor-panel">
          {!editando ? (
            <div className="consola-datos-editor-empty">
              <IconFileSearch size={32} stroke={1.35} className="consola-datos-editor-empty-icon" aria-hidden />
              <h3 className="consola-datos-editor-empty-title">Selecciona un registro</h3>
              <p className="consola-datos-editor-empty-text">
                Elige un registro de la tabla para ver su contenido JSON, editarlo o darlo de baja.
              </p>
            </div>
          ) : (
            <>
              <div className="consola-panel-head">
                <h2 className="consola-panel-title">{puedeEscribir ? 'Editar registro' : 'Detalle del registro'}</h2>
                <p className="consola-panel-subtitle">
                  {puedeEscribir
                    ? 'Modifica el contenido del registro seleccionado y guarda los cambios en la red.'
                    : 'Vista de solo lectura del registro seleccionado.'}
                </p>
              </div>
              <div className="consola-panel-body consola-datos-editor-scroll">
                <dl className="consola-datos-meta">
                  <div>
                    <dt>ID del dato</dt>
                    <dd className="font-mono">{datoId}</dd>
                  </div>
                  <div>
                    <dt>Tipo</dt>
                    <dd>{tipo || '—'}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{registroSeleccionado?.estado ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{registroSeleccionado?.fecha ? formatShortDate(registroSeleccionado.fecha) : '—'}</dd>
                  </div>
                </dl>

                <div className="consola-field consola-datos-json-field">
                  <div className="consola-datos-json-head">
                    <label className="consola-field-label" htmlFor="datos-json-editor">
                      Contenido del registro (JSON)
                    </label>
                    {puedeEscribir ? (
                      <button type="button" className="consola-btn consola-btn--ghost consola-btn--sm" onClick={onFormatearJson}>
                        Formatear JSON
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    id="datos-json-editor"
                    className={`consola-json-editor${jsonError ? ' consola-json-editor--error' : ''}`}
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    readOnly={!puedeEscribir}
                    spellCheck={false}
                  />
                  {jsonError ? <p className="consola-field-error">{jsonError}</p> : null}
                  <p className="consola-field-hint">
                    El contenido debe ser un objeto JSON válido. Usa los datos reales del registro como base.
                  </p>
                </div>
              </div>

              {puedeEscribir ? (
                <div className="consola-datos-editor-actions">
                  <button
                    type="button"
                    disabled={enviando || Boolean(jsonError)}
                    onClick={() => void onGuardar()}
                    className="consola-btn consola-btn--primary"
                  >
                    {enviando ? 'Enviando…' : etiquetaGuardar(rol)}
                  </button>
                  <button type="button" onClick={cancelarEdicion} className="consola-btn consola-btn--secondary">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="consola-btn consola-btn--danger-outline"
                    onClick={() => {
                      const f = filas.find((x) => x.datoId === datoId)
                      if (f) setModalBaja(f)
                    }}
                  >
                    {etiquetaEliminar(rol)}
                  </button>
                </div>
              ) : (
                <div className="consola-datos-editor-actions">
                  <button type="button" onClick={cancelarEdicion} className="consola-btn consola-btn--secondary">
                    Cerrar
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {modalBaja ? (
        <ModalConfirmBaja
          registro={modalBaja}
          rol={rol}
          eliminando={eliminando}
          onCancel={() => setModalBaja(null)}
          onConfirm={() => void ejecutarBaja(modalBaja)}
        />
      ) : null}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const lower = estado.toLowerCase()
  const cls =
    lower.includes('activo') || lower.includes('ok')
      ? 'consola-badge consola-badge--ok'
      : lower.includes('baja') || lower.includes('inactiv')
        ? 'consola-badge consola-badge--warn'
        : 'consola-badge'
  return <span className={cls}>{estado}</span>
}

function EmptyStateLista() {
  return (
    <div className="consola-empty">
      <p className="mb-2 font-semibold text-[#17233a]">No se encontraron registros.</p>
      <p className="mb-0 text-[0.8rem]">
        Cuando el sistema cliente envíe datos mediante la API, aparecerán aquí.
      </p>
    </div>
  )
}

function AvisoExitoCompact({ aviso }: { aviso: AvisoExito }) {
  if (aviso.tipo === 'pendiente') {
    return (
      <div className="consola-alert consola-alert--success" role="status">
        Solicitud enviada correctamente. Quedó pendiente de aprobación del administrador.{' '}
        <Link to="/app/solicitudes" className="consola-link">
          Ver cola de aprobación
        </Link>
      </div>
    )
  }
  return (
    <div className="consola-alert consola-alert--success" role="status">
      Registro confirmado en blockchain.
      {aviso.txId ? (
        <span className="ms-2 font-mono text-[0.72rem] opacity-80">Tx: {aviso.txId.slice(0, 16)}…</span>
      ) : null}{' '}
      <Link to="/app/consultas" state={{ datoId: aviso.datoId }} className="consola-link">
        Consultar
      </Link>
    </div>
  )
}

function ModalConfirmBaja({
  registro,
  rol,
  eliminando,
  onCancel,
  onConfirm,
}: {
  registro: FilaDato
  rol: AppRole
  eliminando: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="consola-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="consola-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-baja-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-baja-title" className="consola-modal-title">
          Confirmar baja del registro
        </h2>
        <p className="consola-modal-text">{mensajeConfirmBaja(rol)}</p>
        <dl className="consola-datos-meta consola-modal-meta">
          <div>
            <dt>ID del dato</dt>
            <dd className="font-mono">{registro.datoId}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{registro.tipo || '—'}</dd>
          </div>
          <div>
            <dt>Estado actual</dt>
            <dd>{registro.estado}</dd>
          </div>
        </dl>
        <div className="consola-modal-actions">
          <button type="button" className="consola-btn consola-btn--secondary" onClick={onCancel} disabled={eliminando}>
            Cancelar
          </button>
          <button type="button" className="consola-btn consola-btn--danger" onClick={onConfirm} disabled={eliminando}>
            {eliminando ? 'Procesando…' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  )
}

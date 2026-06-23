import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../context/AppStoreContext'
import { useSettings } from '../context/SettingsContext'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import { describeApiError } from '../lib/apiErrorMessage'
import { clienteLedgerEstadoResumen } from '../lib/clienteLedgerEstado'
import { displayDatoField } from '../lib/datoDisplay'
import { extraerPayloadDato } from '../lib/datoPayload'
import { consultarDatoApi } from '../services/apiDatos'
import { ApiHttpError } from '../services/apiClient'
import LoteProcesoPanel from '../components/LoteProcesoPanel'
import type { ClienteApiCacheRow } from '../types/api'
import { formatShortDate } from '../lib/format'

function esNoEncontrado(e: unknown): boolean {
  if (e instanceof ApiHttpError && e.status === 404) return true
  const msg = describeApiError(e).toLowerCase()
  return msg.includes('no encontr') || msg.includes('not found')
}

function etiquetaEstado(row: ClienteApiCacheRow): { label: string; cls: string } {
  const s = clienteLedgerEstadoResumen(row)
  if (s === 'activo') return { label: row.estado || 'Activo', cls: 'consola-badge consola-badge--ok' }
  if (s === 'baja') return { label: row.estado || 'Dado de baja', cls: 'consola-badge consola-badge--warn' }
  return { label: row.estado || 'Inactivo', cls: 'consola-badge' }
}

function esPayloadLote(payload: Record<string, unknown>): boolean {
  return (
    'actividades' in payload ||
    'producciones' in payload ||
    'cultivo' in payload ||
    'codigo_trazabilidad' in payload
  )
}

function valorPayloadLegible(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `${value.length} elemento(s)`
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '—'
    return entries
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${displayDatoField(k, v)}`)
      .join(' · ')
  }
  return displayDatoField(key, value)
}

function PayloadGenerico({ payload }: { payload: Record<string, unknown> }) {
  const filas = Object.entries(payload).filter(([k]) => k !== '_baasMeta' && k !== 'notasLedger')

  if (filas.length === 0) {
    return <p className="consola-consulta-empty-inline">Sin contenido adicional en el registro.</p>
  }

  return (
    <table className="consola-table consola-consulta-payload-table">
      <thead>
        <tr>
          <th>Campo</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(([key, value]) => (
          <tr key={key}>
            <td className="consola-consulta-payload-key">{key}</td>
            <td>{valorPayloadLegible(key, value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ContenidoActual({ payload }: { payload: Record<string, unknown> }) {
  if (esPayloadLote(payload)) {
    return <LoteProcesoPanel datos={payload} titulo="Contenido actual" />
  }
  return <PayloadGenerico payload={payload} />
}

export default function ConsultasPage() {
  const location = useLocation()
  const { mode, role, roleLabel } = useSettings()
  const { mergeExternalEvent, upsertDatoRowCache, showToast, pushTrace, refreshDatosLedger } = useAppStore()
  const [datoIdApi, setDatoIdApi] = useState('')
  const [lastRow, setLastRow] = useState<ClienteApiCacheRow | null>(null)
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [consultando, setConsultando] = useState(false)
  const [consultado, setConsultado] = useState(false)

  useEffect(() => {
    const st = location.state as { datoId?: string; clienteId?: string } | null | undefined
    const id =
      typeof st?.datoId === 'string' ? st.datoId.trim() : typeof st?.clienteId === 'string' ? st.clienteId.trim() : ''
    if (id) setDatoIdApi(id)
  }, [location.state])

  const ejecutarConsulta = useCallback(
    async (id: string) => {
      setConsultando(true)
      setLastError(null)
      setNoEncontrado(false)
      setLastRow(null)
      setLastPayload(null)
      setConsultado(true)

      try {
        const res = await consultarDatoApi(id)
        const parsed = parseDatoDatos(res.payloadDecodificado ?? res.datos)
        if (parsed) {
          upsertDatoRowCache(parsed)
          setLastRow(parsed)
          setLastPayload(extraerPayloadDato(res.payloadDecodificado ?? res.datos))
        } else {
          setLastError('Respuesta sin datos reconocibles.')
        }
        mergeExternalEvent({
          tipo: 'consulta',
          estado: 'exito',
          titulo: 'Dato consultado correctamente',
          mensaje: `${res.mensaje} · ${id}`,
        })
        showToast('Consulta completada.', 'success')
        void refreshDatosLedger()
        pushTrace({
          operationType: 'CLIENTE_CONSULTADO',
          mode,
          role,
          state: 'exitoso',
          message: `Consulta completada para ${id}.`,
          clienteId: id,
          steps: [
            { id: 'cap', label: 'Captura de datoId', status: 'exitoso' },
            { id: 'rol', label: 'Validación de rol', status: 'exitoso', detail: `${roleLabel} puede consultar.` },
            { id: 'api', label: 'Solicitud GET /datos/:id', status: 'exitoso' },
            { id: 'res', label: 'Respuesta recibida', status: 'exitoso', detail: res.mensaje },
          ],
        })
      } catch (e) {
        const msg = describeApiError(e)
        if (esNoEncontrado(e)) {
          setNoEncontrado(true)
          setLastError(null)
        } else {
          setLastError(msg)
        }
        showToast(msg, 'error')
        mergeExternalEvent({
          tipo: 'consulta',
          estado: 'error',
          titulo: 'Error al consultar dato',
          mensaje: e instanceof ApiHttpError ? (e.payload?.mensaje ?? msg) : msg,
        })
        pushTrace({
          operationType: 'ERROR_API',
          mode,
          role,
          state: 'error',
          message: `Error al consultar dato ${id}.`,
          clienteId: id,
          httpStatus: e instanceof ApiHttpError ? e.status : undefined,
          errorCode: e instanceof ApiHttpError ? e.payload?.codigo : undefined,
          errorMessage: e instanceof ApiHttpError ? (e.payload?.mensaje ?? msg) : msg,
          steps: [
            { id: 'cap', label: 'Captura de datoId', status: 'exitoso' },
            { id: 'api', label: 'Solicitud GET /datos/:id', status: 'exitoso' },
            { id: 'err', label: 'Error recibido', status: 'error', detail: msg },
          ],
        })
      } finally {
        setConsultando(false)
      }
    },
    [mergeExternalEvent, mode, pushTrace, refreshDatosLedger, role, roleLabel, showToast, upsertDatoRowCache],
  )

  const onSubmitApi = (e: React.FormEvent) => {
    e.preventDefault()
    const id = datoIdApi.trim()
    if (!id) {
      showToast('Indique el ID del dato.', 'error')
      return
    }
    void ejecutarConsulta(id)
  }

  function limpiar() {
    setDatoIdApi('')
    setLastRow(null)
    setLastPayload(null)
    setLastError(null)
    setNoEncontrado(false)
    setConsultado(false)
  }

  const estado = lastRow ? etiquetaEstado(lastRow) : null

  return (
    <div className="consola-consulta">
      <p className="consola-consulta-lead">Busca un registro por ID para revisar su estado actual en Nexum.</p>

      <div className="consola-notice" role="status">
        Consulta disponible por ID del dato. Para revisar eventos históricos o TxID, utiliza las vistas correspondientes
        del sistema.
      </div>

      <section className="consola-panel consola-consulta-form-panel">
        <form onSubmit={onSubmitApi} className="consola-consulta-form">
          <label className="consola-field consola-consulta-field">
            <span className="consola-field-label">ID del dato</span>
            <input
              type="search"
              className="consola-input"
              value={datoIdApi}
              onChange={(e) => setDatoIdApi(e.target.value)}
              placeholder="Ej. AmiLote, lote-yes01, K6-12-0..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="consola-consulta-form-actions">
            <button type="submit" className="consola-btn consola-btn--primary" disabled={consultando}>
              {consultando ? 'Consultando…' : 'Consultar'}
            </button>
            <button type="button" className="consola-btn consola-btn--secondary" onClick={limpiar} disabled={consultando}>
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="consola-panel consola-consulta-result-panel">
        <div className="consola-panel-head">
          <h2 className="consola-panel-title">Estado actual del registro</h2>
          <p className="consola-panel-subtitle">
            {lastRow ? `Registro ${lastRow.clienteId}` : 'Resultado de la consulta por ID'}
          </p>
        </div>

        <div className="consola-consulta-result-body">
          {consultando ? (
            <div className="consola-consulta-loading" aria-busy="true">
              <div className="consola-inventario-skeleton" />
              <div className="consola-inventario-skeleton consola-inventario-skeleton--short" />
            </div>
          ) : !consultado ? (
            <p className="consola-empty">Ingresa un ID de dato para consultar su estado actual.</p>
          ) : noEncontrado ? (
            <p className="consola-empty">No se encontró un registro con ese ID.</p>
          ) : lastError && !lastRow ? (
            <div className="consola-alert consola-alert--error" role="alert">
              {lastError}{' '}
              <button
                type="button"
                className="consola-link consola-link-btn"
                onClick={() => {
                  const id = datoIdApi.trim()
                  if (id) void ejecutarConsulta(id)
                }}
              >
                Reintentar
              </button>
            </div>
          ) : lastRow && estado ? (
            <div className="consola-consulta-result-content">
              <dl className="consola-datos-meta consola-consulta-meta">
                <div>
                  <dt>ID del dato</dt>
                  <dd className="font-mono">{lastRow.clienteId}</dd>
                </div>
                <div>
                  <dt>Nombre / resumen</dt>
                  <dd>{lastRow.nombre || '—'}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{lastRow.tipoDocumento || '—'}</dd>
                </div>
                <div>
                  <dt>Estado actual</dt>
                  <dd>
                    <span className={estado.cls}>{estado.label}</span>
                  </dd>
                </div>
                <div>
                  <dt>Última actualización</dt>
                  <dd>{lastRow.fechaAlta ? formatShortDate(lastRow.fechaAlta) : '—'}</dd>
                </div>
                {lastRow.notas ? (
                  <div className="consola-consulta-meta-wide">
                    <dt>Metadata</dt>
                    <dd>{lastRow.notas}</dd>
                  </div>
                ) : null}
              </dl>

              {lastPayload ? (
                <div className="consola-consulta-payload-section">
                  <h3 className="consola-consulta-payload-title">Contenido actual</h3>
                  <div className="consola-consulta-payload-scroll">
                    <ContenidoActual payload={lastPayload} />
                  </div>
                </div>
              ) : (
                <p className="consola-consulta-empty-inline">El registro no incluye payload de negocio adicional.</p>
              )}
            </div>
          ) : (
            <p className="consola-empty">No se pudo obtener información del registro.</p>
          )}
        </div>
      </section>
    </div>
  )
}

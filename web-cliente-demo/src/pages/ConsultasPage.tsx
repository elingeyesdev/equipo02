import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppStore } from '../context/AppStoreContext'
import { useSettings } from '../context/SettingsContext'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import { describeApiError } from '../lib/apiErrorMessage'
import { buildAccionesFromHistorial } from '../lib/lineaTiempoAcciones'
import { consultarDatoApi, fetchHistorialDato, listarDatosFilas } from '../services/apiDatos'
import { operacionesHistorialDesdeRespuesta } from '../lib/historialDato'
import LoteProcesoPanel from '../components/LoteProcesoPanel'
import LineaTiempoStrip from '../components/LineaTiempoStrip'
import { extraerPayloadDato } from '../lib/datoPayload'
import { ApiHttpError } from '../services/apiClient'
import type { AccionLineaTiempo } from '../lib/historialDato'
import type { ClienteApiCacheRow } from '../types/api'
import { formatShortDate } from '../lib/format'

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink-secondary outline-none placeholder:text-muted focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

const btnPrimary =
  'admin-btn-primary shadow-sm transition-colors hover:bg-accent-hover'

export default function ConsultasPage() {
  const location = useLocation()
  const { mode, role, roleLabel } = useSettings()
  const { mergeExternalEvent, upsertDatoRowCache, showToast, pushTrace, refreshDatosLedger } = useAppStore()
  const [datoIdApi, setDatoIdApi] = useState('')
  const [txIdBusqueda, setTxIdBusqueda] = useState('')
  const [lastRow, setLastRow] = useState<ClienteApiCacheRow | null>(null)
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null)
  const [timeline, setTimeline] = useState<AccionLineaTiempo[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [buscandoTx, setBuscandoTx] = useState(false)

  const cargarTimeline = async (id: string) => {
    setTimelineLoading(true)
    try {
      const r = await fetchHistorialDato(id)
      setTimeline(buildAccionesFromHistorial(operacionesHistorialDesdeRespuesta(r.datos)))
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }

  useEffect(() => {
    const st = location.state as { datoId?: string; clienteId?: string } | null | undefined
    const id = typeof st?.datoId === 'string' ? st.datoId.trim() : typeof st?.clienteId === 'string' ? st.clienteId.trim() : ''
    if (id) setDatoIdApi(id)
  }, [location.state])

  const onSubmitApi = async (e: React.FormEvent) => {
    e.preventDefault()
    setLastError(null)
    setLastRow(null)
    setLastPayload(null)
    const id = datoIdApi.trim()
    if (!id) {
      showToast('Indique el datoId exacto (ej. PARCELA-001).', 'error')
      return
    }
    try {
      const res = await consultarDatoApi(id)
      const parsed = parseDatoDatos(res.payloadDecodificado ?? res.datos)
      if (parsed) {
        upsertDatoRowCache(parsed)
        setLastRow(parsed)
        setLastPayload(extraerPayloadDato(res.payloadDecodificado ?? res.datos))
        void cargarTimeline(id)
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
      setLastError(msg)
      showToast(msg, 'error')
      mergeExternalEvent({
        tipo: 'consulta',
        estado: 'error',
        titulo: 'Error al consultar dato',
        mensaje: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
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
        errorMessage: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
        steps: [
          { id: 'cap', label: 'Captura de datoId', status: 'exitoso' },
          { id: 'api', label: 'Solicitud GET /datos/:id', status: 'exitoso' },
          { id: 'err', label: 'Error recibido', status: 'error', detail: msg },
        ],
      })
    }
  }

  const onBuscarTxId = async () => {
    const tx = txIdBusqueda.trim()
    if (!tx) return
    setBuscandoTx(true)
    setLastError(null)
    try {
      const lista = await listarDatosFilas()
      for (const c of lista) {
        const hist = await fetchHistorialDato(c.clienteId)
        const txIds = operacionesHistorialDesdeRespuesta(hist.datos).map((op) => op.txId)
        if (!txIds.some((t) => t.includes(tx))) continue

        setDatoIdApi(c.clienteId)
        const res = await consultarDatoApi(c.clienteId)
        const parsed = parseDatoDatos(res.payloadDecodificado ?? res.datos)
        if (!parsed) {
          showToast('Registro encontrado pero respuesta ilegible.', 'error')
          return
        }
        upsertDatoRowCache(parsed)
        setLastRow(parsed)
        setLastPayload(extraerPayloadDato(res.payloadDecodificado ?? res.datos))
        await cargarTimeline(c.clienteId)
        showToast(`TxID encontrado en ${c.clienteId}`, 'success')
        return
      }
      showToast('TxID no encontrado en los datos del tenant.', 'error')
    } catch (err) {
      showToast(describeApiError(err), 'error')
    } finally {
      setBuscandoTx(false)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4">
      <div className="alert alert-info mb-0" role="status">
        <h2 className="alert-heading h5 mb-2">Consultar registro</h2>
        <p className="mb-0 small">
          Busca un registro específico por datoId o TxID para revisar su información, historial y evidencia de
          auditoría.
        </p>
      </div>

      <form onSubmit={onSubmitApi} className="admin-card shrink-0 p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            datoId
            <input
              className={`${input} mt-1`}
              value={datoIdApi}
              onChange={(e) => setDatoIdApi(e.target.value)}
              placeholder="PARCELA-001"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="text-xs text-muted">
            TxID (firma digital)
            <input
              className={`${input} mt-1 font-mono text-xs`}
              value={txIdBusqueda}
              onChange={(e) => setTxIdBusqueda(e.target.value)}
              placeholder="Pegar TxID…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className={`${btnPrimary} !py-2 !text-xs`}>
            Consultar por ID
          </button>
          <button
            type="button"
            className={`${btnPrimary} !bg-gray-700 !py-2 !text-xs hover:!bg-gray-800`}
            disabled={buscandoTx || !txIdBusqueda.trim()}
            onClick={() => void onBuscarTxId()}
          >
            {buscandoTx ? 'Buscando…' : 'Buscar por TxID'}
          </button>
          {lastRow ? (
            <Link
              to="/app/auditoria"
              state={{ recursoId: lastRow.clienteId }}
              className="inline-flex items-center rounded-xl border border-line px-3 py-2 text-xs text-ink-secondary hover:bg-gray-50"
            >
              Abrir en Auditar
            </Link>
          ) : null}
        </div>
      </form>

      <div className="admin-card flex min-h-0 flex-1 flex-col overflow-hidden shadow-card">
        <div className="shrink-0 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Resultado</h2>
          <p className="text-xs text-muted">Detalle del registro consultado</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {lastError && !lastRow ? (
            <p className="text-sm text-danger/90">{lastError}</p>
          ) : lastRow ? (
            <div className="space-y-6">
              <DatoResultView row={lastRow} informacionAuditoria={lastRow.informacionAuditoria} />
              {timeline.length > 0 || timelineLoading ? (
                <div className="border-t border-line/60 pt-4">
                  <LineaTiempoStrip
                    registroId={lastRow.clienteId}
                    acciones={timeline}
                    loading={timelineLoading}
                    compact
                  />
                </div>
              ) : null}
              {lastPayload ? (
                <div className="border-t border-line/60 pt-5">
                  <LoteProcesoPanel datos={lastPayload} titulo="Payload de negocio (estado actual)" />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">Ejecute una consulta con un datoId válido.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DatoResultView({
  row,
  informacionAuditoria,
}: {
  row: ClienteApiCacheRow
  informacionAuditoria?: string | null
}) {
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase text-accent">
        {row.tipoDocumento}
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase text-muted">datoId</dt>
          <dd className="mt-0.5 font-mono text-sm text-ink-secondary">{row.clienteId}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-muted">Resumen</dt>
          <dd className="mt-0.5 text-ink-secondary">{row.nombre}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-muted">Estado / tipo</dt>
          <dd className="mt-0.5 text-ink-secondary">{row.estado}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-muted">Última actualización</dt>
          <dd className="mt-0.5 text-ink-secondary">{formatShortDate(row.fechaAlta)}</dd>
        </div>
        {row.notas ? (
          <div className="sm:col-span-2">
            <dt className="text-[11px] uppercase text-muted">metadata</dt>
            <dd className="mt-0.5 text-ink-secondary">{row.notas}</dd>
          </div>
        ) : null}
      </dl>
      {informacionAuditoria?.trim() ? (
        <div className="rounded-xl border border-line/60 bg-gray-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Información de auditoría</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
            {informacionAuditoria}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { fetchAuditoriaCombinada, type AuditoriaCombinadaDatos } from '../services/apiAuditoria'
import { fetchHistorialDato, listarDatosFilas, restaurarDatoRevision } from '../services/apiDatos'
import {
  historialConPayloads,
  type HistorialFilaVista,
  type LineaTiempoRespuesta,
} from '../lib/historialDato'
import { filaEnRangoFecha, filasDesdeHistorialOps, type FilaAuditoriaTabla } from '../lib/auditoriaFilas'
import { buildAccionesFromHistorial, estiloAccionLineaTiempo, iconoAccionLineaTiempo } from '../lib/lineaTiempoAcciones'
import LineaTiempoStrip from '../components/LineaTiempoStrip'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import LoteProcesoPanel from '../components/LoteProcesoPanel'
import { extraerPayloadDato } from '../lib/datoPayload'
import { decodeIfBase64 } from '../lib/ledgerFieldDecode'
import { autorRolDisplayDesdeNotas } from '../lib/notasLedger'

// Detalle de identidad de los actores de auditoría. En el modelo universal NO
// se hardcodean usuarios de un dominio concreto: el detalle proviene del
// backend (cabeceras X-Actor-* / claims). Vacío = no se muestra ficha extra.
type DetalleUsuario = { nombre: string; cargo: string; depto: string; matricula: string; bio: string }
const USUARIOS_DETALLE: Record<string, DetalleUsuario> = {}

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink-secondary outline-none placeholder:text-muted focus:border-accent-soft focus:ring-2 focus:ring-accent/25'
const btn =
  'admin-btn-primary shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center rounded-xl border border-line bg-gray-50 px-4 py-2 text-sm text-ink-secondary hover:bg-gray-50 disabled:opacity-50'
const btnChip =
  'rounded-lg border border-line bg-gray-50 px-2.5 py-1 text-xs text-ink-secondary hover:border-accent/30 hover:text-ink'

type FilaTabla = FilaAuditoriaTabla

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function valorComparable(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function valorGenericoLegible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vacío)'
  if (typeof v === 'object') {
    try {
      const txt = JSON.stringify(v)
      return txt.length > 180 ? `${txt.slice(0, 180)}…` : txt
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function etiquetaCampo(campo: string): string {
  if (campo === 'clienteId' || campo === 'datoId' || campo === 'codigo_trazabilidad') return 'id'
  return campo
}

function datosComparablesRevision(raw: unknown): Record<string, unknown> {
  const origen = extraerPayloadDato(raw) ?? asRecord(raw)
  const omitidos = new Set(['actividades', 'producciones', 'notas', 'notasLedger', '_baasMeta'])
  return Object.fromEntries(Object.entries(origen).filter(([k]) => !omitidos.has(k)))
}

/** Color del indicador en tabla según rol mostrado en «Autor / Rol». */
function colorIndicadorAutor(autor: string): string {
  const a = autor.toLowerCase()
  if (a.includes('admin') || a.includes('supervisor') || a.includes('carlos')) return 'bg-amber-400'
  if (a.includes('integrador') || a.includes('trabajador') || a.includes('operador') || a.includes('ana')) {
    return 'bg-indigo-400'
  }
  if (a.includes('lectura') || a.includes('auditor') || a.includes('pedro')) return 'bg-slate-400'
  return 'bg-slate-400'
}


function filasDesdeDatos(d: AuditoriaCombinadaDatos): FilaTabla[] {
  const out: FilaTabla[] = []
  let n = 0

  for (const ev of d.eventosCadena) {
    const payloadObj =
      ev.payload && typeof ev.payload === 'object' ? (ev.payload as Record<string, unknown>) : null
    const looksLikeDato =
      !!payloadObj &&
      (typeof payloadObj.datoId === 'string' ||
        (payloadObj.payload && typeof payloadObj.payload === 'object'))
    if (!looksLikeDato) continue
    n++
    let fullObj: any = {}
    let codigo = '—'
    let nombre = '—'
    let estado = '—'

    try {
      if (ev.payload) {
        fullObj = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload

        const parsed = parseDatoDatos(fullObj)
        if (parsed) {
          codigo = parsed.clienteId
          nombre = parsed.nombre
          estado = parsed.estado
        } else {
          const payload = fullObj.payload && typeof fullObj.payload === 'object' ? fullObj.payload : null
          codigo = str(
            fullObj.datoId ||
              fullObj.clientId ||
              fullObj.clienteId ||
              fullObj.id ||
              fullObj.codigo ||
              (payload && (payload.codigo_trazabilidad || payload.datoId)) ||
              '—',
          )
          nombre = str((payload && payload.nombre) || fullObj.nombre || fullObj.Nombre || fullObj.name || codigo || '—')
          estado = str((payload && payload.estado) || fullObj.estado || fullObj.Estado || fullObj.status || '—')
        }
      }
    } catch (err) {
      console.error("Error parseando payload de evento:", err)
    }

    const autor = autorRolDisplayDesdeNotas(
      typeof fullObj.notas === 'string' ? fullObj.notas : fullObj.notasLedger,
    )

    // Extraer firma digital de negocio si existe
    let firmaNegocio = ev.txId // Default a TXID
    if (fullObj.notas && typeof fullObj.notas === 'string' && fullObj.notas.includes('FIRMA:')) {
      const match = fullObj.notas.match(/FIRMA: (SIG-[a-f0-9]+)/)
      if (match) firmaNegocio = match[1]
    }

    out.push({
      id: `e-${n}`,
      codigo: decodeIfBase64(codigo),
      nombre: decodeIfBase64(nombre),
      fecha: ev.timestamp,
      estado: estado !== '—' ? estado : 'LEDGER_TX',
      bloque: String(ev.blockNumber),
      firma: firmaNegocio, // Usamos la firma de negocio
      enlace: (ev as any).blockHash || `sha256:blk-${ev.blockNumber}`,
      autor,
      cliente: fullObj,
    })
  }
  return out.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

function toCsv(rows: FilaTabla[]): string {
  const h = ['codigo', 'nombre', 'fecha', 'estado', 'bloque', 'firma_digital_txid', 'enlace_criptografico_hash']
  const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`
  const lines = [h.join(',')]
  for (const r of rows) {
    lines.push([r.codigo, r.nombre, r.fecha, r.estado, r.bloque, r.firma, r.enlace].map(esc).join(','))
  }
  return lines.join('\n')
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** YYYY-MM-DD en UTC (calendario simple para filtros). */
function toYmdUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Estado al llegar desde Centro de avisos → Ver detalles. */
export type AuditarLocationState = {
  recursoId?: string
  txId?: string
}

export default function AuditarPage() {
  const location = useLocation()
  const { mode, apiKey, tenant, role } = useSettings()
  const tenantId = (tenant ?? '').trim().toLowerCase()
  const puedeConsultarApi = mode === 'api' && apiKey.trim().length > 0
  const [limite, setLimite] = useState(150)
  const [desdeDia, setDesdeDia] = useState('')
  const [hastaDia, setHastaDia] = useState('')
  const [registroSeleccionado, setRegistroSeleccionado] = useState<string | null>(null)
  const [timelineAbierta, setTimelineAbierta] = useState<string | null>(null)
  const [filtroTxIdNav, setFiltroTxIdNav] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AuditoriaCombinadaDatos | null>(null)
  const [filasLedger, setFilasLedger] = useState<FilaTabla[]>([])

  // --- Estado para Línea de Tiempo por Registro ---
  const [lineaTiempo, setLineaTiempo] = useState<LineaTiempoRespuesta | null>(null)
  const [historialOps, setHistorialOps] = useState<HistorialFilaVista[]>([])
  const [lotePayloadsLT, setLotePayloadsLT] = useState<Array<Record<string, unknown> | null>>([])
  const [lineaLoading, setLineaLoading] = useState(false)
  const [lineaError, setLineaError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [selectedAccionIdx, setSelectedAccionIdx] = useState<number | null>(null)
  const [selectedUsuario, setSelectedUsuario] = useState<string | null>(null)
  const [restaurandoTxId, setRestaurandoTxId] = useState<string | null>(null)

  const buscarLineaTiempo = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed) return
    setRegistroSeleccionado(trimmed)
    setLineaLoading(true)
    setLineaError(null)
    setLineaTiempo(null)
    setHistorialOps([])
    setLotePayloadsLT([])
    setSelectedAccionIdx(null)
    try {
      const hist = await fetchHistorialDato(id)
      const { filas, payloads } = historialConPayloads(hist.datos)
      setLineaTiempo({ ok: true, clienteId: trimmed, acciones: buildAccionesFromHistorial(filas) })
      setHistorialOps(filas)
      setLotePayloadsLT(payloads)
    } catch (e) {
      setLineaError(describeApiError(e))
    } finally {
      setLineaLoading(false)
    }
  }, [])

  const navegacionProcesada = useRef<string | null>(null)

  const cargarFilasLedger = useCallback(async () => {
    const lista = await listarDatosFilas()
    const ids = lista.map((c) => c.clienteId)

    const out: FilaTabla[] = []
    for (const id of ids.slice(0, 80)) {
      try {
        const hist = await fetchHistorialDato(id)
        const { filas } = historialConPayloads(hist.datos)
        out.push(...filasDesdeHistorialOps(id, filas))
      } catch {
        // omitir registros sin historial accesible
      }
    }
    return out
  }, [tenantId])

  const load = useCallback(async () => {
    if (!puedeConsultarApi) {
      setError('En modo API hace falta una X-API-Key guardada en Credenciales.')
      setDatos(null)
      setFilasLedger([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const d = await fetchAuditoriaCombinada(limite, desdeDia.trim(), hastaDia.trim())
      setDatos(d)
      const ledgerFilas = await cargarFilasLedger()
      setFilasLedger(ledgerFilas)
    } catch (e) {
      setError(describeApiError(e))
      setDatos(null)
      setFilasLedger([])
    } finally {
      setLoading(false)
    }
  }, [limite, desdeDia, hastaDia, puedeConsultarApi, cargarFilasLedger])

  useEffect(() => {
    const st = location.state as AuditarLocationState | null
    if (!puedeConsultarApi || !st) return
    const id = st.recursoId?.trim()
    const tx = st.txId?.trim()
    const clave = `${location.key}:${id ?? ''}:${tx ?? ''}`
    if (navegacionProcesada.current === clave) return
    if (!id && !tx) return
    navegacionProcesada.current = clave
    if (tx) setFiltroTxIdNav(tx)
    if (id) {
      setExpandidos((prev) => new Set(prev).add(id))
      setRegistroSeleccionado(id)
      setTimelineAbierta(id)
      void buscarLineaTiempo(id)
    }
    void load()
  }, [location.key, location.state, puedeConsultarApi, buscarLineaTiempo, load])

  const restaurarRevision = useCallback(async (datoId: string, txId: string) => {
    if (!datoId.trim() || !txId.trim()) return
    const ok = window.confirm(
      'Se creará un NUEVO bloque con los datos de esta revisión histórica. La cadena no se borra. ¿Deseas continuar?',
    )
    if (!ok) return

    setRestaurandoTxId(txId)
    setLineaError(null)
    try {
      await restaurarDatoRevision(datoId, txId)
      await Promise.all([buscarLineaTiempo(datoId), load()])
      setSelectedAccionIdx(null)
      window.alert('Revisión restaurada correctamente como un nuevo bloque.')
    } catch (e) {
      setLineaError(describeApiError(e))
    } finally {
      setRestaurandoTxId(null)
    }
  }, [buscarLineaTiempo, load])

  const filas = useMemo(() => {
    const fromEventos = datos ? filasDesdeDatos(datos) : []
    const seenTx = new Set(fromEventos.map((r) => r.firma))
    let list = [...fromEventos]
    for (const f of filasLedger) {
      if (!seenTx.has(f.firma)) {
        list.push(f)
        seenTx.add(f.firma)
      }
    }

    list = list.filter((r) => {
      const c = (r.codigo || '').toUpperCase()
      return !c.endsWith('_DRAFT') && !/_REV_\d+$/.test(c)
    })

    if (filtroTxIdNav.trim()) {
      const q = filtroTxIdNav.toLowerCase().trim()
      return list.filter((r) => r.firma.toLowerCase().includes(q))
    }

    if (desdeDia.trim() || hastaDia.trim()) {
      list = list.filter((r) => filaEnRangoFecha(r.fecha, desdeDia, hastaDia))
    }

    return list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [datos, filasLedger, filtroTxIdNav, desdeDia, hastaDia, tenantId])

  // Agrupación: 1 fila por clienteId. Cada grupo recuerda en qué índices
  // del array plano `filas` están sus eventos para poder reabrir el modal
  // de detalle (que usa `selectedIdx`).
  type GrupoCliente = {
    codigo: string
    nombre: string
    fechaUltima: string
    autorUltimo: string
    estadoUltimo: string
    eventos: Array<{ fila: FilaTabla; idxPlano: number }>
  }

  const grupos = useMemo<GrupoCliente[]>(() => {
    const map = new Map<string, GrupoCliente>()
    filas.forEach((fila, idx) => {
      const key = fila.codigo || '—'
      const ev = { fila, idxPlano: idx }
      const g = map.get(key)
      if (!g) {
        map.set(key, {
          codigo: key,
          nombre: fila.nombre,
          fechaUltima: fila.fecha,
          autorUltimo: fila.autor,
          estadoUltimo: fila.estado,
          eventos: [ev],
        })
      } else {
        g.eventos.push(ev)
        if (new Date(fila.fecha).getTime() > new Date(g.fechaUltima).getTime()) {
          g.fechaUltima = fila.fecha
          g.autorUltimo = fila.autor
          g.estadoUltimo = fila.estado
          g.nombre = fila.nombre
        }
      }
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.fechaUltima).getTime() - new Date(a.fechaUltima).getTime(),
    )
  }, [filas])

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const toggleExpandido = useCallback((codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
      } else {
        next.add(codigo)
      }
      return next
    })
  }, [])

  const onCopiar = (texto: string) => {
    navigator.clipboard.writeText(texto)
    // Podríamos añadir un toast aquí, pero por simplicidad usaremos un console log
    console.log("Copiado:", texto)
  }

  const onExportJson = () => {
    if (!datos) return
    downloadText(`auditoria-${Date.now()}.json`, JSON.stringify(datos, null, 2), 'application/json')
  }

  const onExportCsv = () => {
    if (!filas.length) return
    downloadText(`auditoria-${Date.now()}.csv`, toCsv(filas), 'text/csv;charset=utf-8')
  }

  const presetRango = (dias: number) => {
    const fin = new Date()
    const ini = new Date(Date.now() - dias * 86400000)
    setDesdeDia(toYmdUtc(ini))
    setHastaDia(toYmdUtc(fin))
    setFiltroTxIdNav('')
  }

  const presetHoy = () => {
    const t = toYmdUtc(new Date())
    setDesdeDia(t)
    setHastaDia(t)
    setFiltroTxIdNav('')
  }

  const cerrarTimeline = useCallback(() => {
    setTimelineAbierta(null)
    setLineaTiempo(null)
    setLineaError(null)
    setSelectedAccionIdx(null)
  }, [])

  const toggleTimeline = useCallback(
    (codigo: string, e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (timelineAbierta === codigo) {
        cerrarTimeline()
        return
      }
      setTimelineAbierta(codigo)
      setRegistroSeleccionado(codigo)
      setExpandidos((prev) => new Set(prev).add(codigo))
      void buscarLineaTiempo(codigo)
    },
    [timelineAbierta, buscarLineaTiempo, cerrarTimeline],
  )

  const onFilaRegistroClick = useCallback(
    (codigo: string) => {
      setRegistroSeleccionado(codigo)
      toggleExpandido(codigo)
    },
    [toggleExpandido],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0">
        <h1 className="text-lg font-semibold text-ink">Auditar</h1>
        <p className="mt-0.5 text-xs text-muted">Eventos del ledger · selecciona un registro para ver su línea de tiempo</p>
      </div>

      {!puedeConsultarApi ? (
        <div className="rounded-xl border admin-alert-warning">
          <p>
            {mode !== 'api'
              ? 'Pasá a modo «Red / API» en Credenciales para consultar el middleware.'
              : 'No hay X-API-Key guardada. Sin esa cabecera el backend responde 401 y la consola muestra CREDENCIAL_AUSENTE.'}
          </p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/app/credenciales">
            Abrir Credenciales
          </Link>
        </div>
      ) : null}

      <div className="shrink-0 admin-card p-3 shadow-card">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btnChip} onClick={presetHoy}>Hoy</button>
            <button type="button" className={btnChip} onClick={() => presetRango(7)}>7 días</button>
            <button type="button" className={btnChip} onClick={() => presetRango(30)}>30 días</button>
            <button type="button" className={btnChip} onClick={() => { setDesdeDia(''); setHastaDia('') }}>Limpiar</button>
          </div>
          <input type="date" className={`${input} !w-auto !py-1.5 text-xs`} value={desdeDia} onChange={(e) => setDesdeDia(e.target.value)} title="Desde" />
          <input type="date" className={`${input} !w-auto !py-1.5 text-xs`} value={hastaDia} onChange={(e) => setHastaDia(e.target.value)} title="Hasta" />
          <input type="number" min={1} max={1000} value={limite} onChange={(e) => setLimite(Number(e.target.value))} className={`${input} !w-20 !py-1.5 text-xs`} title="Límite" />
          <button type="button" className={`${btn} !py-1.5 !text-xs`} disabled={loading || !puedeConsultarApi} onClick={() => void load()}>
            {loading ? '…' : 'Consultar'}
          </button>
          <Link to="/app/consultas" className="inline-flex items-center rounded-xl border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink-secondary">
            Buscar por ID / TxID →
          </Link>
          <button type="button" className={`${btnGhost} !py-1.5 !text-xs`} disabled={!datos && filasLedger.length === 0} onClick={onExportJson}>JSON</button>
          <button type="button" className={`${btnGhost} !py-1.5 !text-xs`} disabled={!filas.length} onClick={onExportCsv}>CSV</button>
        </div>
        {filtroTxIdNav ? (
          <p className="mt-2 text-[11px] text-amber-700">
            Filtro TxID: <span className="font-mono">{filtroTxIdNav.slice(0, 24)}…</span>
            <button type="button" className="ml-2 text-accent hover:underline" onClick={() => setFiltroTxIdNav('')}>Quitar</button>
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          <p>{error}</p>
          {error.includes('401') || error.includes('403') ? (
            <p className="mt-2 text-xs text-muted">Revise X-API-Key y rol en Credenciales.</p>
          ) : null}
        </div>
      ) : null}

      {/* UNIFIED GIT-STYLE AUDIT DASHBOARD */}
      {selectedAccionIdx !== null && lineaTiempo?.acciones[selectedAccionIdx] && (() => {
        const selectedAcc = lineaTiempo.acciones[selectedAccionIdx]
        const opActual = historialOps[selectedAccionIdx]
        const opAnterior = selectedAccionIdx > 0 ? historialOps[selectedAccionIdx - 1] : null
        const actualComparable = datosComparablesRevision(opActual?.cliente)
        const anteriorComparable = datosComparablesRevision(opAnterior?.cliente)
        const campos = Array.from(new Set([...Object.keys(anteriorComparable), ...Object.keys(actualComparable)]))

        const selectedAutor = autorRolDisplayDesdeNotas(opActual?.cliente ?? undefined)
        const esRevisionEliminada = Boolean(opActual?.isDelete)

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedAccionIdx(null)}
          >
            <div
              className="w-full max-w-5xl h-[85vh] rounded-2xl border border-line bg-surface shadow-card-md animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Navbar */}
              <div className="flex items-center justify-between border-b border-line bg-gray-50 px-6 py-4">
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    Panel de Auditoría de Blockchain — Control de Revisiones
                  </h2>
                  <p className="text-[10px] text-muted mt-0.5">Código de Registro: <span className="font-mono text-ink-secondary font-bold">{lineaTiempo.clienteId}</span></p>
                </div>
                <button
                  onClick={() => setSelectedAccionIdx(null)}
                  className="admin-btn-secondary !rounded-lg !px-3.5 !py-1.5 !text-xs"
                >
                  Cerrar
                </button>
              </div>

              {/* Main Content Area: Split View */}
              <div className="flex flex-1 min-h-0 divide-x divide-line/30">
                {/* Left Column: Revisions Sidebar (vertical timeline) */}
                <div className="w-1/3 bg-gray-50 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">Línea de Tiempo del Registro</p>
                  
                  <div className="space-y-2">
                    {lineaTiempo.acciones.map((acc, idx) => {
                      const isSelected = selectedAccionIdx === idx
                      const estilo = estiloAccionLineaTiempo(acc.tipo)

                      return (
                        <button
                          key={`${acc.txId}-${idx}`}
                          onClick={() => setSelectedAccionIdx(idx)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                            isSelected ? `${estilo.chip} ring-1 ring-[#1a3a5c]/15` : 'border-line/60 bg-white hover:border-line'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${estilo.icon}`}>
                            {iconoAccionLineaTiempo(acc.tipo)}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${estilo.text}`}>
                                {acc.tipo === 'creado'
                                  ? 'Snap Original (Bloque)'
                                  : acc.tipo === 'baja'
                                    ? 'Baja'
                                    : acc.etiqueta}
                              </span>
                            </div>
                            <p className="text-[10px] text-ink-secondary truncate mt-0.5">{formatDemoDateTime(acc.fecha)}</p>
                            <p className="text-[9px] text-muted font-mono truncate mt-1">Tx: {acc.txId.slice(0, 24)}…</p>
                            {acc.restauradoDesdeTxId ? (
                              <p className="text-[9px] text-amber-600 mt-1">Restaurado desde tx: {acc.restauradoDesdeTxId.slice(0, 20)}…</p>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Right Column: Comparative attributes view */}
                <div className="w-2/3 flex flex-col bg-surface overflow-hidden">
                  {/* Action Details Header */}
                  <div className="bg-gray-50 border-b border-line/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Detalle de la Modificación</p>
                    <h3 className="text-xs font-bold text-ink mt-1">
                      {selectedAcc.tipo === 'creado'
                        ? 'Snap Inmutable Inicial (Creación)'
                        : selectedAcc.tipo === 'baja'
                          ? 'Baja lógica'
                          : selectedAcc.etiqueta}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mt-3 text-[10px] text-muted bg-white p-2.5 rounded-lg border border-line/60">
                      <div>
                        <span className="text-muted block">Autor / Firma digital:</span>
                        <span className="text-ink-secondary font-medium">{selectedAutor}</span>
                      </div>
                      <div>
                        <span className="text-muted block">Fecha de Registro (Ledger):</span>
                        <span className="text-ink-secondary font-medium">{formatDemoDateTime(selectedAcc.fecha)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted block">Enlace Criptográfico / TxID:</span>
                        <span className="text-ink-secondary font-mono block break-all">{selectedAcc.txId}</span>
                      </div>
                    </div>

                    {role === 'admin' ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="rounded-lg bg-[#1a3a5c] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0f2844] disabled:opacity-50"
                          disabled={restaurandoTxId === selectedAcc.txId || esRevisionEliminada}
                          onClick={() => void restaurarRevision(lineaTiempo.clienteId, selectedAcc.txId)}
                          title={
                            esRevisionEliminada
                              ? 'No se puede restaurar una revisión de eliminación'
                              : 'Crear un nuevo bloque con los datos de esta revisión'
                          }
                        >
                          {restaurandoTxId === selectedAcc.txId ? 'Restaurando…' : 'Restaurar esta revisión'}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Attributes Comparison Table */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {lotePayloadsLT[selectedAccionIdx] ? (
                      <div className="mb-4 rounded-xl border border-line/60 bg-white p-4">
                        <LoteProcesoPanel
                          datos={lotePayloadsLT[selectedAccionIdx]}
                          titulo="Proceso del lote en esta revisión"
                          compacto
                        />
                      </div>
                    ) : null}
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-[10px] uppercase text-muted">
                          <th className="py-2.5 w-1/3">Atributo</th>
                          <th className="py-2.5">
                            {selectedAccionIdx === 0 ? 'Valor Registrado' : 'Estado Actual / Cambio'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40">
                        {campos.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="py-8 text-center text-muted italic">Sin datos registrados.</td>
                          </tr>
                        ) : (
                          campos.map((campo) => {
                            const valActual = actualComparable[campo]
                            const valAnterior = anteriorComparable[campo]
                            const actualStr = valorGenericoLegible(valActual)
                            const anteriorStr = valorGenericoLegible(valAnterior)

                            const cambió =
                              opAnterior !== null && valorComparable(valAnterior) !== valorComparable(valActual)

                            return (
                              <tr key={campo} className={`transition-colors ${cambió ? 'bg-amber-50/80 hover:bg-amber-50' : 'hover:bg-gray-50'}`}>
                                <td className={`py-3 font-semibold ${cambió ? 'text-[#1a2332]' : 'text-muted'}`}>
                                  {etiquetaCampo(campo)}
                                </td>
                                <td className="py-3">
                                  {cambió ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-[10px] text-red-800 line-through">
                                        {anteriorStr || '(vacío)'}
                                      </span>
                                      <span className="text-muted text-[10px]">→</span>
                                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-900">
                                        {actualStr || '(vacío)'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-mono text-ink-secondary">{actualStr || '—'}</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Legend */}
                  <div className="flex items-center justify-start border-t border-line px-6 py-3 bg-gray-50">
                    <div className="flex items-center gap-4 text-[10px] text-muted">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-red-400"></div>
                        <span>Anterior</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
                        <span>Nuevo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden admin-card shadow-card">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
          <p className="text-xs text-muted">
            {datos || filasLedger.length > 0
              ? `${grupos.length} registro(s) · HTTP ${datos?.totalHttp ?? 0} · cadena ${datos?.totalEventos ?? 0}`
              : 'Pulse Consultar para cargar'}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-gray-50 text-xs uppercase text-muted backdrop-blur-sm">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Última actividad</th>
              <th className="px-3 py-2 font-medium">Autor / Rol</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium text-center"># Cambios</th>
              <th className="px-3 py-2 font-medium text-center w-36">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {grupos.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  {datos || filasLedger.length > 0
                    ? 'No hay registros que coincidan con los filtros activos.'
                    : 'Pulse Consultar para cargar la auditoría de Blockchain (Ledger).'}
                </td>
              </tr>
            ) : null}
            {grupos.map((g) => {
              const isOpen = expandidos.has(g.codigo)
              const isSelected = registroSeleccionado === g.codigo
              const timelineVisible = timelineAbierta === g.codigo
              return (
                <Fragment key={g.codigo}>
                  <tr
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent/25' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onFilaRegistroClick(g.codigo)}
                  >
                    <td className="px-2 py-2 text-center text-muted">
                      <svg
                        className={`mx-auto h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">{g.codigo}</td>
                    <td className="px-3 py-2 text-ink-secondary">{g.nombre}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDemoDateTime(g.fechaUltima)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${colorIndicadorAutor(g.autorUltimo)}`}></div>
                        <span className="text-[11px] font-medium text-ink-secondary">{g.autorUltimo}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${g.estadoUltimo.includes('ACTIVO') || g.estadoUltimo.includes('exito') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-muted'}`}>
                        {g.estadoUltimo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-accent/20 px-2 text-[10px] font-bold text-accent">
                        {g.eventos.length}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                          timelineVisible
                            ? 'bg-accent text-white hover:bg-accent-hover'
                            : 'border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20'
                        }`}
                        onClick={(e) => toggleTimeline(g.codigo, e)}
                      >
                        {lineaLoading && timelineVisible ? '…' : timelineVisible ? 'Ocultar línea' : 'Línea de tiempo'}
                      </button>
                    </td>
                  </tr>

                  {timelineVisible && (
                    <tr className="bg-accent/5">
                      <td colSpan={8} className="border-t border-accent/15 px-4 py-1">
                        <LineaTiempoStrip
                          registroId={g.codigo}
                          acciones={lineaTiempo?.clienteId === g.codigo ? lineaTiempo.acciones : []}
                          selectedIdx={selectedAccionIdx}
                          onSelect={setSelectedAccionIdx}
                          compact
                          loading={lineaLoading}
                          error={lineaError}
                          onClose={cerrarTimeline}
                        />
                      </td>
                    </tr>
                  )}

                  {isOpen && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-0 py-0">
                        <div className="overflow-hidden border-t border-line">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                              <tr>
                                <th className="px-3 py-1.5 font-medium">Fecha</th>
                                <th className="px-3 py-1.5 font-medium text-center">Bloque</th>
                                <th className="px-3 py-1.5 font-medium">Autor / Rol</th>
                                <th className="px-3 py-1.5 font-medium">Estado</th>
                                <th className="px-3 py-1.5 font-medium">Firma digital (TxID)</th>
                                <th className="px-3 py-1.5 font-medium">Enlace criptográfico</th>
                                <th className="px-3 py-1.5 font-medium text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line/60">
                              {[...g.eventos]
                                .sort((a, b) => new Date(a.fila.fecha).getTime() - new Date(b.fila.fecha).getTime())
                                .map((ev, idxEnGrupo) => {
                                  const r = ev.fila
                                  const i = ev.idxPlano
                                  const accionTimeline =
                                    lineaTiempo?.clienteId === g.codigo
                                      ? lineaTiempo.acciones.find((a) => a.txId === r.firma)
                                      : null
                                  const etiquetaCambio =
                                    accionTimeline?.etiqueta ?? (idxEnGrupo === 0 ? 'Creado' : `Edición #${idxEnGrupo}`)
                                  const estilo = accionTimeline
                                    ? estiloAccionLineaTiempo(accionTimeline.tipo)
                                    : null
                                  return (
                                    <tr
                                      key={r.id}
                                      className={`hover:bg-gray-50 ${selectedIdx === i ? 'bg-accent/10' : ''}`}
                                    >
                                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                                        <span className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                          estilo ? `${estilo.icon} ${estilo.text}` : 'bg-accent/10 text-accent'
                                        }`}>
                                          {etiquetaCambio}
                                        </span>
                                        {formatDemoDateTime(r.fecha)}
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent">{r.bloque}</span>
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1.5 group">
                                          <div className={`h-1.5 w-1.5 rounded-full ${colorIndicadorAutor(r.autor)}`}></div>
                                          <span className="text-[11px] font-medium text-ink-secondary">{r.autor}</span>
                                          {USUARIOS_DETALLE[r.autor] && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setSelectedUsuario(r.autor) }}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-accent/10 p-1 text-accent hover:bg-accent hover:text-white"
                                              title="Ver credencial de identidad"
                                            >
                                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6" /></svg>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${r.estado.includes('ACTIVO') || r.estado.includes('exito') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-muted'}`}>{r.estado}</span>
                                      </td>
                                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted">
                                        <div className="flex items-center gap-2">
                                          <span>{r.firma.slice(0, 12)}…</span>
                                          <button onClick={(e) => { e.stopPropagation(); onCopiar(r.firma) }} className="rounded bg-surface p-1 hover:bg-accent/20 hover:text-accent transition-colors" title="Copiar firma">
                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5 font-mono text-[10px] text-accent/80">
                                        <div className="flex items-center gap-2">
                                          <span>{r.enlace.slice(0, 16)}…</span>
                                          <button onClick={(e) => { e.stopPropagation(); onCopiar(r.enlace) }} className="rounded bg-surface p-1 hover:bg-accent/20 hover:text-accent transition-colors" title="Copiar enlace">
                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedIdx(selectedIdx === i ? null : i) }}
                                          className="rounded-lg bg-accent/20 px-3 py-1 text-[10px] font-bold text-accent hover:bg-accent/30 transition-all uppercase"
                                        >
                                          {selectedIdx === i ? 'Cerrar' : 'Ver Detalle'}
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal de Detalle (Tarjeta Flotante con DIFF) */}
      {selectedIdx !== null && filas[selectedIdx] && (() => {
        const row = filas[selectedIdx]
        const indexAnterior = filas.findIndex((r, idx) => idx > selectedIdx && r.codigo === row.codigo)
        const rowAnterior = indexAnterior !== -1 ? filas[indexAnterior] : null

        const actualComparable = datosComparablesRevision(row.cliente)
        const anteriorComparable = datosComparablesRevision(rowAnterior?.cliente)
        const campos = Array.from(new Set([...Object.keys(anteriorComparable), ...Object.keys(actualComparable)]))

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-2xl border border-accent/30 bg-gray-50 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {rowAnterior ? 'Comparativa de Cambios' : 'Registro Inicial del Cliente'}
                  </h3>
                  <p className="text-[10px] text-muted font-mono truncate max-w-[300px]">{row.firma}</p>
                </div>
                <button onClick={() => setSelectedIdx(null)} className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-ink-secondary hover:bg-gray-50 transition-colors">Cerrar</button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-4">
                  {extraerPayloadDato(row.cliente) ? (
                    <div className="rounded-xl border border-line/60 bg-surface/20 p-4">
                      <LoteProcesoPanel datos={row.cliente} titulo="Payload en esta transacción" />
                    </div>
                  ) : null}
                  <div className="overflow-hidden rounded-xl border border-line bg-surface/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Campo</th>
                          <th className="px-4 py-2 font-semibold">Estado Actual / Cambio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {campos.map((campo) => {
                          const cambio = {
                            anterior: anteriorComparable[campo],
                            nuevo: actualComparable[campo],
                          }
                          const huboCambio =
                            valorComparable(anteriorComparable[campo]) !== valorComparable(actualComparable[campo])
                          return (
                            <tr key={campo} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5 font-medium text-muted">{etiquetaCampo(campo)}</td>
                              <td className="px-4 py-2.5">
                                {huboCambio ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400 line-through decoration-rose-500/50">
                                      {valorGenericoLegible(cambio.anterior)}
                                    </span>
                                    <span className="text-muted">→</span>
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 font-semibold">
                                      {valorGenericoLegible(cambio.nuevo)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-ink-secondary font-mono">
                                    {valorGenericoLegible(actualComparable[campo])}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-500"></div> <span className="text-muted">Anterior</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500"></div> <span className="text-muted">Nuevo</span></div>
                </div>
                <button onClick={() => setSelectedIdx(null)} className="btn-accent rounded-lg bg-accent px-6 py-2 text-xs font-bold text-white shadow-lg shadow-accent/20">Entendido</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL DE IDENTIDAD DIGITAL (TARGET) */}
      {selectedUsuario && USUARIOS_DETALLE[selectedUsuario] && (() => {
        const user = USUARIOS_DETALLE[selectedUsuario]
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl animate-in zoom-in-95 duration-300">
              {/* Banner Decorativo */}
              <div className="h-24 bg-gradient-to-r from-accent to-accent-hover"></div>

              {/* Foto de Perfil */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface bg-gray-50 shadow-xl">
                  <span className="text-3xl font-bold text-accent">{user.nombre.charAt(0)}</span>
                </div>
              </div>

              <div className="mt-16 px-8 pb-10 text-center">
                <h3 className="text-xl font-bold text-ink">{user.nombre}</h3>
                <p className="text-sm font-semibold text-accent">{user.cargo}</p>
                <p className="mt-1 text-xs text-muted">{user.depto}</p>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-md bg-gray-50 p-4 border border-line">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Matrícula</p>
                    <p className="mt-1 font-mono text-sm font-bold text-ink-secondary">{user.matricula}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-4 border border-line">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Estado Red</p>
                    <p className="mt-1 text-sm font-bold text-emerald-400">Verificado ✅</p>
                  </div>
                </div>

                <div className="mt-6 text-left">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Biografía y Atribuciones</p>
                  <p className="text-xs leading-relaxed text-muted italic">"{user.bio}"</p>
                </div>

                <button
                  onClick={() => setSelectedUsuario(null)}
                  className="mt-8 w-full rounded-2xl bg-accent py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Cerrar Credencial
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

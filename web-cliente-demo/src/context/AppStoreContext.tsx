import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { describeApiError, isCredentialHttpError } from '../lib/apiErrorMessage'
import { loadApiClientesCache, saveApiClientesCache, upsertApiClienteCache } from '../lib/apiClientesCache'
import { loadTraceEntries, saveTraceEntries } from '../lib/tracePersist'
import { listarDatosFilas } from '../services/apiDatos'
import { useSettings } from './SettingsContext'
import type { ClienteApi, ClienteApiCacheRow } from '../types/api'
import type { DemoEvent, TraceEntry } from '../types/demo'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface AppStoreValue {
  /** Filas del ledger vía GET /datos (modelo universal). */
  datosLedger: ClienteApi[]
  datosLedgerLoading: boolean
  datosLedgerError: string | null
  datosLedgerAccessDenied: boolean
  refreshDatosLedger: () => Promise<void>
  /** Filas vistas en sesión tras consultas API (caché local). */
  datoRowsCache: ClienteApiCacheRow[]
  upsertDatoRowCache: (row: ClienteApiCacheRow) => void
  eventos: DemoEvent[]
  traces: TraceEntry[]
  mergeExternalEvent: (ev: Omit<DemoEvent, 'id' | 'fechaIso'> & { fechaIso?: string }) => void
  limpiarEventos: () => void
  pushTrace: (trace: Omit<TraceEntry, 'id' | 'createdAt'> & { createdAt?: string }) => TraceEntry
  toasts: ToastItem[]
  dismissToast: (id: string) => void
  showToast: (message: string, variant?: ToastVariant) => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

let entitySeq = 0
function newEntityId(prefix: string): string {
  entitySeq += 1
  return `${prefix}-${Date.now()}-${entitySeq}`
}

function appendEvent(prev: DemoEvent[], ev: Omit<DemoEvent, 'id' | 'fechaIso'> & { fechaIso?: string }): DemoEvent[] {
  const full: DemoEvent = {
    id: newEntityId('evt'),
    fechaIso: ev.fechaIso ?? new Date().toISOString(),
    tipo: ev.tipo,
    estado: ev.estado,
    titulo: ev.titulo,
    mensaje: ev.mensaje,
    referencia: ev.referencia,
  }
  return [full, ...prev].slice(0, 200)
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { mode, apiKey, tenant } = useSettings()
  const [eventos, setEventos] = useState<DemoEvent[]>([])
  const [datoRowsCache, setDatoRowsCache] = useState<ClienteApiCacheRow[]>(() => loadApiClientesCache())
  const [datosLedger, setDatosLedger] = useState<ClienteApi[]>([])
  const [datosLedgerLoading, setDatosLedgerLoading] = useState(false)
  const [datosLedgerError, setDatosLedgerError] = useState<string | null>(null)
  const [datosLedgerAccessDenied, setDatosLedgerAccessDenied] = useState(false)
  const [traces, setTraces] = useState<TraceEntry[]>(() => loadTraceEntries())
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const tenantActivoRef = useRef((tenant ?? '').trim().toLowerCase())

  useEffect(() => {
    const actual = (tenant ?? '').trim().toLowerCase()
    const previo = tenantActivoRef.current
    if (previo !== actual) {
      tenantActivoRef.current = actual
      setEventos([])
      setDatoRowsCache([])
      setTraces([])
    }
  }, [tenant])

  const refreshDatosLedger = useCallback(async () => {
    setDatosLedgerLoading(true)
    setDatosLedgerError(null)
    setDatosLedgerAccessDenied(false)
    try {
      const list = await listarDatosFilas()
      setDatosLedger(list)
    } catch (e) {
      setDatosLedger([])
      setDatosLedgerError(describeApiError(e))
      setDatosLedgerAccessDenied(isCredentialHttpError(e))
    } finally {
      setDatosLedgerLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'api') {
      setDatosLedger([])
      setDatosLedgerError(null)
      setDatosLedgerAccessDenied(false)
      return
    }
    if (!apiKey.trim()) {
      setDatosLedger([])
      setDatosLedgerError(null)
      setDatosLedgerAccessDenied(true)
      return
    }
    if (!tenant.trim()) {
      setDatosLedger([])
      setDatosLedgerError(null)
      setDatosLedgerAccessDenied(false)
      return
    }
    void refreshDatosLedger()
  }, [refreshDatosLedger, mode, apiKey, tenant])

  useEffect(() => {
    saveApiClientesCache(datoRowsCache)
  }, [datoRowsCache])

  useEffect(() => {
    saveTraceEntries(traces)
  }, [traces])

  const upsertDatoRowCache = useCallback((row: ClienteApiCacheRow) => {
    setDatoRowsCache((list) => upsertApiClienteCache(list, row))
  }, [])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = newEntityId('toast')
    setToasts((t) => [...t, { id, message, variant }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const mergeExternalEvent = useCallback((ev: Omit<DemoEvent, 'id' | 'fechaIso'> & { fechaIso?: string }) => {
    setEventos((e) => appendEvent(e, ev))
  }, [])

  const limpiarEventos = useCallback(() => {
    setEventos([])
    showToast('Actividad reciente limpiada.', 'success')
  }, [showToast])

  const pushTrace = useCallback((trace: Omit<TraceEntry, 'id' | 'createdAt'> & { createdAt?: string }) => {
    const full: TraceEntry = {
      ...trace,
      id: newEntityId('trz'),
      createdAt: trace.createdAt ?? new Date().toISOString(),
    }
    setTraces((list) => [full, ...list].slice(0, 300))
    return full
  }, [])

  const value = useMemo(
    () => ({
      datosLedger,
      datosLedgerLoading,
      datosLedgerError,
      datosLedgerAccessDenied,
      refreshDatosLedger,
      datoRowsCache,
      upsertDatoRowCache,
      eventos,
      traces,
      mergeExternalEvent,
      limpiarEventos,
      pushTrace,
      toasts,
      dismissToast,
      showToast,
    }),
    [
      datosLedger,
      datosLedgerLoading,
      datosLedgerError,
      datosLedgerAccessDenied,
      refreshDatosLedger,
      datoRowsCache,
      upsertDatoRowCache,
      eventos,
      traces,
      mergeExternalEvent,
      limpiarEventos,
      pushTrace,
      toasts,
      dismissToast,
      showToast,
    ],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore debe usarse dentro de AppStoreProvider')
  return ctx
}

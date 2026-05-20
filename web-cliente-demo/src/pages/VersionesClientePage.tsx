import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { ClienteApi } from '../types/api'
import { parseClienteDatos } from '../lib/apiClienteAdapter'
import { displayClienteField } from '../lib/clienteDisplay'
import {
  crearBorradorApi,
  confirmarBorradorApi,
  revertirRevisionApi,
  obtenerRevisionesApi,
} from '../services/apiVersiones'
import { consultarClienteApi } from '../services/apiClientes'
import { ApiHttpError } from '../services/apiClient'

/** Normaliza lectura API + campos de versiones (revision, draft). */
function clienteParaVista(datos: unknown): ClienteApi | null {
  const parsed = parseClienteDatos(datos)
  if (!parsed) return null
  if (!datos || typeof datos !== 'object') return parsed
  const o = datos as Record<string, unknown>
  return {
    ...parsed,
    revision: typeof o.revision === 'number' ? o.revision : parsed.revision,
    isDraft: o.isDraft === true ? true : parsed.isDraft,
    draftOf: typeof o.draftOf === 'string' ? o.draftOf : parsed.draftOf,
  }
}

type FilaDetalle = { label: string; value: string; audit?: boolean }

function filasDetallePresentacion(c: ClienteApi, opts?: { incluirEstado?: boolean }): FilaDetalle[] {
  const filas: FilaDetalle[] = [
    { label: 'Nombre', value: displayClienteField('nombre', c.nombre) },
    {
      label: 'Documento',
      value: `${displayClienteField('tipoDocumento', c.tipoDocumento)} ${displayClienteField('numeroDocumento', c.numeroDocumento)}`.trim(),
    },
    { label: 'Fecha Alta', value: displayClienteField('fechaAlta', c.fechaAlta) },
    { label: 'Telefono', value: displayClienteField('telefono', c.telefono) || '—' },
    { label: 'Email', value: displayClienteField('email', c.email) || '—' },
  ]
  if (opts?.incluirEstado) {
    filas.splice(3, 0, { label: 'Estado', value: displayClienteField('estado', c.estado) })
  }
  const notas = displayClienteField('notas', c.notas)
  filas.push({ label: 'Notas', value: notas === '(vacío)' ? '—' : notas })
  if (c.informacionAuditoria?.trim()) {
    filas.push({
      label: 'Informacion de auditoria',
      value: c.informacionAuditoria,
      audit: true,
    })
  }
  return filas
}

function ClienteDetalleDl({
  cliente,
  incluirEstado,
}: {
  cliente: ClienteApi
  incluirEstado?: boolean
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
      {filasDetallePresentacion(cliente, { incluirEstado }).map(({ label, value, audit }) => (
        <div key={label} className={audit ? 'col-span-2 sm:col-span-3' : undefined}>
          <dt className="text-muted">{label}</dt>
          <dd
            className={
              audit
                ? 'mt-0.5 whitespace-pre-wrap rounded-lg border border-line/60 bg-surface/40 p-2 text-[11px] text-muted'
                : 'truncate text-slate-200'
            }
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function RevBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
      Rev {n}
    </span>
  )
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${color}`}>
      {label}
    </span>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  const base = 'fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl px-5 py-3.5 text-sm font-medium shadow-2xl ring-1 ring-inset'
  const cls = type === 'success'
    ? `${base} bg-emerald-950 text-emerald-300 ring-emerald-500/30`
    : `${base} bg-red-950 text-red-300 ring-red-500/30`
  return <div className={cls}>{msg}</div>
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function VersionesClientePage() {
  const { clienteId = '' } = useParams<{ clienteId: string }>()

  const [cliente, setCliente] = useState<ClienteApi | null>(null)
  const [revisiones, setRevisiones] = useState<ClienteApi[]>([])
  const [hasDraftActive, setHasDraftActive] = useState(false)
  const [loadingCliente, setLoadingCliente] = useState(true)
  const [loadingRev, setLoadingRev] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const loadCliente = useCallback(async () => {
    setLoadingCliente(true)
    try {
      const res = await consultarClienteApi(clienteId)
      setCliente(clienteParaVista(res.payloadDecodificado ?? res.datos))
    } catch {
      setCliente(null)
    } finally {
      setLoadingCliente(false)
    }
  }, [clienteId])

  const loadRevisiones = useCallback(async () => {
    setLoadingRev(true)
    try {
      const res = await obtenerRevisionesApi(clienteId)
      const revs = (res.revisiones ?? [])
        .map((rev) => clienteParaVista(rev))
        .filter((r): r is ClienteApi => r !== null)
      setRevisiones(revs)
    } catch {
      setRevisiones([])
    } finally {
      setLoadingRev(false)
    }
  }, [clienteId])

  // Detectar si ya existe un borrador activo intentando leerlo
  const checkDraft = useCallback(async () => {
    try {
      await consultarClienteApi(clienteId + '_DRAFT')
      setHasDraftActive(true)
    } catch {
      setHasDraftActive(false)
    }
  }, [clienteId])

  const refresh = useCallback(() => {
    void loadCliente()
    void loadRevisiones()
    void checkDraft()
  }, [loadCliente, loadRevisiones, checkDraft])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ── Acciones ──────────────────────────────────────────────────────────────

  const handleCrearBorrador = async () => {
    setBusy(true)
    try {
      const res = await crearBorradorApi(clienteId)
      showToast(res.mensaje)
      refresh()
    } catch (e) {
      showToast(e instanceof ApiHttpError ? e.message : 'Error al crear borrador', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCommit = async () => {
    if (!confirm('Confirmar y publicar el borrador al registro oficial?')) return
    setBusy(true)
    try {
      const res = await confirmarBorradorApi(clienteId)
      showToast(res.mensaje)
      refresh()
    } catch (e) {
      showToast(e instanceof ApiHttpError ? e.message : 'Error al confirmar borrador', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleRollback = async (rev: number) => {
    if (!confirm(`Restaurar el cliente al estado de la Revision ${rev}? Esta accion crea un nuevo commit.`)) return
    setBusy(true)
    try {
      const res = await revertirRevisionApi(clienteId, rev)
      showToast(res.mensaje)
      refresh()
    } catch (e) {
      showToast(e instanceof ApiHttpError ? e.message : 'Error al revertir revision', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const estadoColor =
    cliente?.estado === 'ACTIVO'
      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
      : cliente?.estado === 'DADO_DE_BAJA'
        ? 'bg-red-500/15 text-red-300 ring-red-500/30'
        : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 pb-8">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/clientes-registrados" className="text-xs text-muted hover:text-accent">
            Clientes
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-slate-100">
            Control de versiones{' '}
            <span className="font-mono text-accent">{clienteId}</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Borrador → commit → historial inmutable
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={busy || loadingCliente}
          className="rounded-xl bg-surface px-4 py-2 text-xs font-medium text-slate-300 ring-1 ring-inset ring-line hover:text-accent disabled:opacity-50"
        >
          Refrescar
        </button>
      </div>

      {/* Registro oficial */}
      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Registro Oficial (Produccion)</span>
          {!loadingCliente && cliente && <RevBadge n={cliente.revision ?? 0} />}
          {!loadingCliente && cliente && (
            <StatusPill label={cliente.estado} color={estadoColor} />
          )}
        </div>

        {loadingCliente ? (
          <p className="text-xs text-muted animate-pulse">Cargando...</p>
        ) : cliente ? (
          <ClienteDetalleDl cliente={cliente} />
        ) : (
          <p className="text-xs text-danger/80">No se pudo cargar el cliente.</p>
        )}
      </section>

      {/* Acciones */}
      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <p className="mb-3 text-sm font-semibold text-slate-200">Acciones de version</p>
        <div className="flex flex-wrap gap-3">

          <button
            id="btn-crear-borrador"
            onClick={() => void handleCrearBorrador()}
            disabled={busy || hasDraftActive}
            title={hasDraftActive ? 'Ya existe un borrador activo' : 'Crear copia de trabajo editable'}
            className="rounded-xl bg-indigo-600/80 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Crear Borrador
          </button>

          <button
            id="btn-commit"
            onClick={() => void handleCommit()}
            disabled={busy || !hasDraftActive}
            title={!hasDraftActive ? 'Crea un borrador primero' : 'Publicar borrador al registro oficial'}
            className="rounded-xl bg-emerald-600/80 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Commit (Publicar)
          </button>
        </div>

        {hasDraftActive && (
          <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Borrador activo:{' '}
            <code className="font-mono">{clienteId}_DRAFT</code>. Editalo desde la API y
            luego haz <strong>Commit</strong> para publicarlo.
          </p>
        )}
      </section>

      {/* Historial de revisiones */}
      <section className="rounded-2xl border border-line bg-elevated/90 shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-sm font-semibold text-slate-200">
            Historial de Revisiones
            {!loadingRev && (
              <span className="ml-2 text-xs font-normal text-muted">
                ({revisiones.length} instantanea{revisiones.length !== 1 ? 's' : ''})
              </span>
            )}
          </p>
        </div>

        {loadingRev ? (
          <p className="px-5 py-6 text-xs text-muted animate-pulse">Cargando revisiones...</p>
        ) : revisiones.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted">
            Sin revisiones historicas. Realiza al menos un <strong>Commit</strong> para generar el primer snapshot.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {revisiones.map((rev, idx) => {
              const isOpen = expanded === idx
              return (
                <li key={rev.clienteId} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/40" />
                        <span className="text-[10px] font-bold text-indigo-300">{rev.revision ?? idx}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <RevBadge n={rev.revision ?? idx} />
                          <StatusPill label={rev.estado} color={estadoColor} />
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-muted">{rev.clienteId}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpanded(isOpen ? null : idx)}
                        className="rounded-lg px-3 py-1.5 text-xs text-slate-400 ring-1 ring-inset ring-line hover:text-accent"
                      >
                        {isOpen ? 'Ocultar' : 'Ver datos'}
                      </button>
                      <button
                        onClick={() => void handleRollback(rev.revision ?? idx)}
                        disabled={busy}
                        className="rounded-xl bg-amber-600/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
                      >
                        Restaurar
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-xl border border-line bg-surface/60 p-4">
                      <ClienteDetalleDl cliente={rev} incluirEstado />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

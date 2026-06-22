import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SnippetBlock, copyToClipboard, inputClass } from '../components/onboarding/OnboardingUi'
import type { DevTenantRequest } from '../services/devPortalApi'
import {
  activarSolicitud,
  getSolicitudPlataforma,
  marcarProvisioning,
  rechazarSolicitud,
  type ActivateResult,
} from '../services/platformApi'

const FABRIC_CMD = './scripts/fabric-despliegue/agregar_tenant.sh'

export default function PlatformRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [solicitud, setSolicitud] = useState<DevTenantRequest | null>(null)
  const [resultado, setResultado] = useState<ActivateResult | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checklist, setChecklist] = useState({ canal: false, middleware: false, bff: false })

  const load = useCallback(async () => {
    if (!id) return
    const s = await getSolicitudPlataforma(id)
    setSolicitud(s)
  }, [id])

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'))
  }, [load])

  const fabricCommand = solicitud
    ? `${FABRIC_CMD} ${solicitud.tenantId}`
    : FABRIC_CMD

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  if (!solicitud && !error) {
    return <div className="p-8 text-center text-sm">Cargando…</div>
  }

  if (!solicitud) {
    return <div className="p-8 text-center text-sm text-red-600">{error}</div>
  }

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-8">
          <Link to="/admin/solicitudes" className="text-sm text-[#6b7280]">← Cola</Link>
          <h1 className="text-lg font-bold">{solicitud.orgName}</h1>
          <span className="rounded-full bg-[#f4f7fb] px-2 py-0.5 text-xs font-semibold">{solicitud.status}</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
        <section className="rounded-2xl border border-line/60 bg-white p-6">
          <h2 className="font-bold">Datos de la solicitud</h2>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-[#6b7280]">tenant_id</dt><dd className="font-mono">{solicitud.tenantId}</dd></div>
            <div><dt className="text-[#6b7280]">Dominio</dt><dd>{solicitud.domain || '—'}</dd></div>
            <div><dt className="text-[#6b7280]">Email</dt><dd>{solicitud.contactEmail}</dd></div>
            <div><dt className="text-[#6b7280]">Integración</dt><dd>{solicitud.integration?.entityType} / {solicitud.integration?.stack}</dd></div>
          </dl>

          <h3 className="mt-6 text-sm font-semibold">Usuarios consola solicitados</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {solicitud.users.map((u) => (
              <li key={u.username}>
                <code>{u.username}</code> — {u.nombreCompleto} ({u.rol})
              </li>
            ))}
          </ul>

          {solicitud.integration?.payloadExample ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-[#1a3a5c]">integration_json</summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-[#f4f7fb] p-3 text-xs">{JSON.stringify(solicitud.integration, null, 2)}</pre>
            </details>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#1a3a5c]/20 bg-[#1a3a5c]/5 p-6">
          <h2 className="font-bold text-[#1a3a5c]">Provisioning Fabric (manual)</h2>
          <p className="mt-2 text-sm text-[#6b7280]">
            Ejecuta en la red Hyperledger antes de activar:
          </p>
          <SnippetBlock title="Comando sugerido" value={fabricCommand} onCopy={() => copyToClipboard(fabricCommand)} />

          <div className="mt-4 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.canal} onChange={(e) => setChecklist((c) => ({ ...c, canal: e.target.checked }))} />
              Canal Fabric creado ({solicitud.tenantId})
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.middleware} onChange={(e) => setChecklist((c) => ({ ...c, middleware: e.target.checked }))} />
              api-middleware reiniciado (tras export tenants.yaml)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.bff} onChange={(e) => setChecklist((c) => ({ ...c, bff: e.target.checked }))} />
              BFF recargó usuarios-admin.yaml
            </label>
          </div>
        </section>

        {(solicitud.status === 'pending' || solicitud.status === 'provisioning') && (
          <section className="rounded-2xl border border-line/60 bg-white p-6">
            <h2 className="font-bold">Acciones</h2>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {solicitud.status === 'pending' ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full border border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] disabled:opacity-50"
                  onClick={() => void runAction(async () => { await marcarProvisioning(solicitud.id) })}
                >
                  Marcar provisioning
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || !checklist.canal}
                className="rounded-full bg-[#f0b429] px-4 py-2 text-sm font-bold text-[#1a2332] disabled:opacity-50"
                onClick={() => void runAction(async () => {
                  const res = await activarSolicitud(solicitud.id)
                  setResultado(res)
                })}
              >
                Activar (export yaml + keys)
              </button>
            </div>
            <div className="mt-6 border-t border-line/40 pt-4">
              <label className="block text-xs font-medium text-[#6b7280]">
                Motivo de rechazo
                <input className={`${inputClass} mt-1`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </label>
              <button
                type="button"
                disabled={busy}
                className="mt-3 rounded-full border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                onClick={() => void runAction(async () => {
                  await rechazarSolicitud(solicitud.id, motivo)
                  navigate('/admin/solicitudes')
                })}
              >
                Rechazar
              </button>
            </div>
          </section>
        )}

        {resultado ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="font-bold text-emerald-900">Tenant activado</h2>
            <p className="mt-2 text-sm">Reinicia api-middleware si aún no lo hiciste.</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-[#6b7280]">URL</dt><dd className="font-mono text-xs">{resultado.middlewareUrl}</dd></div>
              {Object.entries(resultado.apiKeys).map(([rol, key]) => (
                <div key={rol}>
                  <dt className="text-[#6b7280]">Key {rol}</dt>
                  <dd className="font-mono text-xs">{key}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-4 text-sm font-semibold">Contraseñas consola (entregar al cliente)</h3>
            <ul className="mt-2 text-sm">
              {Object.entries(resultado.userPasswords).map(([user, pwd]) => (
                <li key={user}><code>{user}</code> / <code>{pwd}</code></li>
              ))}
            </ul>
            <Link to={`/dev/estado/${solicitud.id}`} className="mt-4 inline-block text-sm font-medium text-[#1a3a5c]">
              Ver estado cliente →
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  )
}

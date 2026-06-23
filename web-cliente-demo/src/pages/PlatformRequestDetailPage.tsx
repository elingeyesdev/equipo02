import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DevRequestStatusBadge,
  formatDevRequestDate,
} from '../components/dev/DevRequestStatusUi'
import { SnippetBlock, copyToClipboard } from '../components/onboarding/OnboardingUi'
import type { DevRequestStatus, DevTenantRequest } from '../services/devPortalApi'
import {
  activarSolicitud,
  getSolicitudPlataforma,
  marcarProvisioning,
  rechazarSolicitud,
  type ActivateResult,
} from '../services/platformApi'

const FABRIC_CMD = './scripts/fabric-despliegue/agregar_tenant.sh'
const RELOAD_CMD = './scripts/reload-middleware.sh'

const ROL_LABELS: Record<string, string> = {
  admin: 'Admin',
  integrador: 'Integrador',
  lectura: 'Lectura',
}

const KEY_HINTS: Record<string, { label: string; hint: string }> = {
  admin: {
    label: 'API Key Admin',
    hint: 'Uso administrativo interno del tenant. No se entrega al dev integrador desde el Portal Integrador.',
  },
  integrador: {
    label: 'API Key Integrador',
    hint: 'Usada por el backend del cliente para enviar operaciones.',
  },
  lectura: {
    label: 'API Key Lectura',
    hint: 'Usada para consultar datos, historial y trazabilidad sin modificar.',
  },
}

function storageKey(id: string) {
  return `platform_activate_result_${id}`
}

function leerResultadoGuardado(id: string): ActivateResult | null {
  try {
    const raw = sessionStorage.getItem(storageKey(id))
    if (!raw) return null
    return JSON.parse(raw) as ActivateResult
  } catch {
    return null
  }
}

function guardarResultado(id: string, res: ActivateResult) {
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify(res))
  } catch {
    /* ignore */
  }
}

function CopyField({
  label,
  hint,
  value,
}: {
  label: string
  hint?: string
  value: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    copyToClipboard(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-4">
      <div className="fw-semibold mb-1">{label}</div>
      {hint ? <p className="text-secondary small mb-2">{hint}</p> : null}
      <div className="d-flex flex-wrap gap-2 align-items-start">
        <code className="flex-grow-1 p-2 bg-light rounded small text-break">{value}</code>
        <button type="button" className="btn btn-sm btn-outline-secondary shrink-0" onClick={handleCopy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

export default function PlatformRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [solicitud, setSolicitud] = useState<DevTenantRequest | null>(null)
  const [resultado, setResultado] = useState<ActivateResult | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checklist, setChecklist] = useState({ canal: false, middleware: false, bff: false })
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const s = await getSolicitudPlataforma(id)
    setSolicitud(s)
    if (s.status === 'active') {
      const stored = leerResultadoGuardado(id)
      if (stored) setResultado(stored)
    }
  }, [id])

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'))
  }, [load])

  const fabricCommand = solicitud ? `${FABRIC_CMD} ${solicitud.tenantId}` : FABRIC_CMD

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
    return <div className="container-xl py-5 text-center text-secondary">Cargando…</div>
  }

  if (!solicitud) {
    return (
      <div className="container-xl py-5">
        <div className="alert alert-danger">{error}</div>
        <Link to="/admin/solicitudes" className="btn btn-outline-primary">
          ← Volver a solicitudes
        </Link>
      </div>
    )
  }

  const status = solicitud.status as DevRequestStatus
  const fecha = formatDevRequestDate(solicitud.updatedAt ?? solicitud.createdAt)
  const integ = solicitud.integration
  const credenciales = resultado
  const keyOrder = ['admin', 'integrador', 'lectura'] as const

  return (
    <div className="container-xl py-4">
      <Link to="/admin/solicitudes" className="btn btn-ghost-secondary btn-sm mb-3">
        ← Solicitudes de integración
      </Link>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <h1 className="h2 mb-0">{solicitud.orgName}</h1>
        <DevRequestStatusBadge status={solicitud.status} />
      </div>

      {/* A) Resumen */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Resumen de solicitud</h3>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="text-secondary small">Organización</div>
              <div className="fw-semibold">{solicitud.orgName}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Tenant ID</div>
              <div className="font-monospace">{solicitud.tenantId}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Estado</div>
              <div className="mt-1">
                <DevRequestStatusBadge status={solicitud.status} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Contacto integrador</div>
              <div>{solicitud.contactEmail}</div>
            </div>
            {fecha ? (
              <div className="col-md-6">
                <div className="text-secondary small">Última actualización</div>
                <div>{fecha}</div>
              </div>
            ) : null}
            <div className="col-md-6">
              <div className="text-secondary small">ID solicitud</div>
              <div className="font-monospace small text-break">{solicitud.id}</div>
            </div>
            {solicitud.domain ? (
              <div className="col-md-6">
                <div className="text-secondary small">Dominio</div>
                <div>{solicitud.domain}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* B) Integración */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Datos de integración</h3>
        </div>
        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="text-secondary small">Entidad</div>
              <div>{integ?.entityName || '—'}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Campo identificador</div>
              <div className="font-monospace">{integ?.businessIdField || '—'}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Tipo de dato</div>
              <div>{integ?.entityType || '—'}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Stack elegido</div>
              <div className="text-capitalize">{integ?.stack || '—'}</div>
            </div>
          </div>
          {integ?.payloadExample ? (
            <div>
              <div className="text-secondary small mb-2">Payload de ejemplo</div>
              <pre className="p-3 bg-light rounded small mb-0">{integ.payloadExample}</pre>
            </div>
          ) : null}
        </div>
      </div>

      {/* C) Usuarios consola */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Usuarios solicitados para consola</h3>
        </div>
        <div className="table-responsive">
          <table className="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre completo</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {solicitud.users.map((u) => (
                <tr key={u.username}>
                  <td>
                    <code>{u.username}</code>
                  </td>
                  <td>{u.nombreCompleto}</td>
                  <td>{ROL_LABELS[u.rol] ?? u.rol}</td>
                  <td className="text-secondary small">
                    {status === 'active'
                      ? 'Activo'
                      : status === 'rejected'
                        ? 'No creado'
                        : 'Pendiente de activación'}
                  </td>
                </tr>
              ))}
              {solicitud.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-3">
                    Sin usuarios definidos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* D) Decisión del operador */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Decisión del operador</h3>
        </div>
        <div className="card-body">
          {error ? <div className="alert alert-danger">{error}</div> : null}

          {status === 'pending' ? (
            <>
              <p className="text-secondary small mb-3">
                Revisa la solicitud y aprueba para pasar a provisioning, o recházala si no cumple los
                requisitos.
              </p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-primary"
                  onClick={() => void runAction(async () => { await marcarProvisioning(solicitud.id) })}
                >
                  Aprobar (pasar a provisioning)
                </button>
              </div>
              <div className="pt-3 border-top">
                <label className="form-label">Motivo de rechazo</label>
                <input className="form-control" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-outline-danger mt-2"
                  onClick={() => void runAction(async () => {
                    await rechazarSolicitud(solicitud.id, motivo)
                    navigate('/admin/solicitudes')
                  })}
                >
                  Rechazar solicitud
                </button>
              </div>
            </>
          ) : null}

          {status === 'provisioning' ? (
            <>
              <p className="text-secondary small mb-3">
                Completa la configuración técnica y activa el tenant para generar credenciales.
              </p>
              <button
                type="button"
                disabled={busy || !checklist.canal}
                className="btn btn-warning"
                onClick={() => void runAction(async () => {
                  const res = await activarSolicitud(solicitud.id)
                  setResultado(res)
                  guardarResultado(solicitud.id, res)
                })}
              >
                Activar tenant
              </button>
              {!checklist.canal ? (
                <p className="text-secondary small mt-2 mb-0">
                  Marca el checklist de canal Fabric en «Avanzado técnico» antes de activar.
                </p>
              ) : null}
            </>
          ) : null}

          {status === 'active' ? (
            <div className="alert alert-success mb-0">
              <strong>Tenant activo.</strong> El integrador puede consultar su estado y credenciales
              permitidas desde el Portal Integrador.
            </div>
          ) : null}

          {status === 'rejected' ? (
            <div className="alert alert-danger mb-0">
              <h4 className="alert-heading h5">Solicitud rechazada</h4>
              <p className="mb-0">{solicitud.rejectReason || 'Sin motivo registrado.'}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Credenciales generadas */}
      {status === 'active' && credenciales ? (
        <div className="card mb-4 border-success">
          <div className="card-header bg-success-lt">
            <h3 className="card-title text-success">Credenciales generadas</h3>
          </div>
          <div className="card-body">
            <CopyField
              label="URL middleware"
              value={credenciales.middlewareUrl}
            />
            {keyOrder.map((rol) => {
              const key = credenciales.apiKeys[rol]
              if (!key) return null
              const meta = KEY_HINTS[rol]
              return (
                <CopyField key={rol} label={meta.label} hint={meta.hint} value={key} />
              )
            })}
            {Object.entries(credenciales.apiKeys)
              .filter(([rol]) => !keyOrder.includes(rol as (typeof keyOrder)[number]))
              .map(([rol, key]) => (
                <CopyField key={rol} label={`API Key ${rol}`} value={key} />
              ))}

            {Object.keys(credenciales.userPasswords).length > 0 ? (
              <div className="mt-4 pt-4 border-top">
                <h4 className="h5 mb-3">Usuarios de consola</h4>
                <div className="table-responsive">
                  <table className="table table-sm table-vcenter">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Contraseña temporal</th>
                        <th className="w-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(credenciales.userPasswords).map(([user, pwd]) => (
                        <tr key={user}>
                          <td>
                            <code>{user}</code>
                          </td>
                          <td className="font-monospace small">{pwd}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => copyToClipboard(pwd)}
                            >
                              Copiar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <p className="text-secondary small mt-3 mb-2">
              El integrador solo verá las keys Integrador y Lectura en el Portal Integrador.
            </p>
            <Link
              to={`/admin/solicitudes/${solicitud.id}/preview-integrador`}
              className="btn btn-outline-primary btn-sm"
            >
              Previsualizar vista del integrador
            </Link>
          </div>
        </div>
      ) : status === 'active' && !credenciales ? (
        <div className="card mb-4">
          <div className="card-body">
            <p className="text-secondary small mb-0">
              Las credenciales se mostraron al activar el tenant en esta consola. Si necesitas
              consultarlas de nuevo, revisa el registro de la sesión de activación o vuelve a cargar
              tras activar en el mismo navegador.
            </p>
            <Link
              to={`/admin/solicitudes/${solicitud.id}/preview-integrador`}
              className="btn btn-outline-primary btn-sm mt-3"
            >
              Previsualizar vista del integrador
            </Link>
          </div>
        </div>
      ) : null}

      {/* Avanzado técnico */}
      {(status === 'pending' || status === 'provisioning') && (
        <div className="card mb-4">
          <div className="card-header">
            <button
              type="button"
              className="btn btn-link text-reset w-100 text-start p-0 text-decoration-none"
              onClick={() => setAvanzadoAbierto((v) => !v)}
              aria-expanded={avanzadoAbierto}
            >
              <h3 className="card-title mb-0">
                Avanzado técnico {avanzadoAbierto ? '▾' : '▸'}
              </h3>
            </button>
            <div className="card-subtitle text-secondary">
              Información técnica para soporte, depuración o defensa del proyecto.
            </div>
          </div>
          {avanzadoAbierto ? (
            <div className="card-body">
              <p className="text-secondary small">Ejecuta en la red Hyperledger antes de activar:</p>
              <SnippetBlock title="Comando Fabric" value={fabricCommand} onCopy={() => copyToClipboard(fabricCommand)} />
              <SnippetBlock title="Reiniciar middleware" value={RELOAD_CMD} onCopy={() => copyToClipboard(RELOAD_CMD)} />
              <div className="mt-3">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={checklist.canal}
                    onChange={(e) => setChecklist((c) => ({ ...c, canal: e.target.checked }))}
                  />
                  <span className="form-check-label">Canal Fabric creado ({solicitud.tenantId})</span>
                </label>
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={checklist.middleware}
                    onChange={(e) => setChecklist((c) => ({ ...c, middleware: e.target.checked }))}
                  />
                  <span className="form-check-label">api-middleware reiniciado ({RELOAD_CMD})</span>
                </label>
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={checklist.bff}
                    onChange={(e) => setChecklist((c) => ({ ...c, bff: e.target.checked }))}
                  />
                  <span className="form-check-label">BFF recargó usuarios-admin.yaml</span>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

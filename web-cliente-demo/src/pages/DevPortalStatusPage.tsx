import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import IntegrationCodePanel from '../components/codegen/IntegrationCodePanel'
import {
  DEV_STATUS_META,
  DevRequestFlowTimeline,
  DevRequestStatusBadge,
  formatDevRequestDate,
  formatSolicitudLoadError,
} from '../components/dev/DevRequestStatusUi'
import { copyToClipboard, inputClass } from '../components/onboarding/OnboardingUi'
import { useDevAuth } from '../context/DevAuthContext'
import type { StackTarget } from '../lib/onboardingSnippets'
import {
  getDevCredenciales,
  getDevSolicitud,
  type DevRequestStatus,
  type DevTenantRequest,
} from '../services/devPortalApi'

const ROL_LABELS: Record<string, string> = {
  admin: 'Admin',
  integrador: 'Integrador',
  lectura: 'Lectura',
}

function formatCredError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('activo') && lower.includes('credencial')) {
    return 'Las credenciales estarán disponibles cuando el tenant esté activo.'
  }
  if (
    lower.includes('sesión') ||
    lower.includes('sesion') ||
    lower.includes('acceso') ||
    lower.includes('email')
  ) {
    return 'No se pudieron cargar las credenciales. Inicia sesión con la misma cuenta que envió la solicitud.'
  }
  return message
}

function CredField({
  label,
  hint,
  value,
}: {
  label: string
  hint: string
  value: string | null | undefined
}) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  const handleCopy = () => {
    copyToClipboard(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-4">
      <div className="fw-semibold mb-1">{label}</div>
      <p className="text-secondary small mb-2">{hint}</p>
      <div className="d-flex flex-wrap gap-2 align-items-start">
        <code className="flex-grow-1 p-2 bg-light rounded small text-break">{value}</code>
        <button type="button" className="btn btn-sm btn-outline-secondary shrink-0" onClick={handleCopy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

function CopyPasswordButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    copyToClipboard(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCopy}>
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

export default function DevPortalStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isOperatorPreview = searchParams.get('preview') === 'operator'
  const { estado: devEstado, usuario } = useDevAuth()
  const [solicitud, setSolicitud] = useState<DevTenantRequest | null>(null)
  const [email, setEmail] = useState('')
  const [credError, setCredError] = useState<string | null>(null)
  const [middlewareUrl, setMiddlewareUrl] = useState('http://localhost:3000')
  const [integradorKey, setIntegradorKey] = useState<string | null>(null)
  const [lecturaKey, setLecturaKey] = useState<string | null>(null)
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const s = await getDevSolicitud(id)
      setSolicitud(s)
      setEmail(s.contactEmail)
      setLoadError(null)
    } catch (e) {
      setSolicitud((prev) => {
        if (prev === null) {
          setLoadError(formatSolicitudLoadError(e).message)
        }
        return prev
      })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15000)
    return () => clearInterval(t)
  }, [load])

  const stack = (solicitud?.integration?.stack ?? 'laravel') as StackTarget

  const rolPorUsuario = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of solicitud?.users ?? []) {
      if (u.username?.trim()) {
        map.set(u.username.trim(), u.rol)
      }
    }
    return map
  }, [solicitud?.users])

  const ctx = useMemo(() => {
    const attrs = solicitud?.integration
    const payload = attrs?.payloadExample ?? '{}'
    const pendingKey = `${solicitud?.tenantId ?? 'tenant'}-integrador-PENDIENTE`
    return {
      baseUrl: isOperatorPreview ? 'http://localhost:3000' : middlewareUrl,
      apiKey: isOperatorPreview ? pendingKey : (integradorKey ?? pendingKey),
      apiKeyRole: 'integrador' as const,
      entityName: attrs?.entityName ?? 'Entidad',
      businessIdField: attrs?.businessIdField ?? 'id',
      entityType: attrs?.entityType ?? 'registro',
      schemaVersion: attrs?.schemaVersion ?? 'v1',
      payloadExampleText: payload,
      attributes: attrs?.attributes,
    }
  }, [solicitud, middlewareUrl, integradorKey, isOperatorPreview])

  const fetchCredenciales = async (emailArg?: string) => {
    if (!id) return
    setCredError(null)
    try {
      const cred = await getDevCredenciales(id, emailArg)
      setMiddlewareUrl(cred.middlewareUrl)
      setIntegradorKey(cred.keys.integrador ?? null)
      setLecturaKey(cred.keys.lectura ?? null)
      setUserPasswords(cred.userPasswords ?? {})
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'No se pudieron obtener credenciales'
      setCredError(formatCredError(raw))
    }
  }

  useEffect(() => {
    if (isOperatorPreview) return
    if (solicitud?.status === 'active' && devEstado === 'autenticado') {
      void fetchCredenciales()
    }
  }, [solicitud?.status, devEstado, id, isOperatorPreview])

  if (loading && !solicitud) {
    return <div className="container-xl py-5 text-center text-secondary">Cargando estado…</div>
  }

  if (!solicitud) {
    return (
      <div className="container-xl py-5">
        <div className="card mx-auto" style={{ maxWidth: '32rem' }}>
          <div className="card-body text-center py-5">
            <div className="alert alert-danger mb-4">{loadError ?? 'Solicitud no encontrada.'}</div>
            <Link to="/dev/mis-solicitudes" className="btn btn-outline-primary me-2">
              Mis solicitudes
            </Link>
            <Link to="/dev" className="btn btn-outline-secondary">
              Volver al portal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusMeta = DEV_STATUS_META[solicitud.status as DevRequestStatus] ?? DEV_STATUS_META.draft
  const fecha = formatDevRequestDate(solicitud.updatedAt ?? solicitud.createdAt)
  const keysPending = isOperatorPreview || solicitud.status !== 'active' || !integradorKey
  const credencialesCargadas = !isOperatorPreview && !!(integradorKey || lecturaKey)

  return (
    <div className="container-xl py-4">
      {isOperatorPreview ? (
        <div className="alert alert-warning mb-4" role="status">
          <strong>Vista previa de operador:</strong> estás viendo cómo se presentará esta solicitud al
          integrador. Esta vista no cambia permisos ni inicia sesión como dev.
          {id ? (
            <Link to={`/admin/solicitudes/${id}`} className="btn btn-sm btn-outline-secondary ms-0 ms-md-3 mt-2 mt-md-0 d-block d-md-inline-block">
              ← Volver a Consola Operador
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">Estado de solicitud</h2>
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
              <div className="text-secondary small">Estado actual</div>
              <div className="mt-1">
                <DevRequestStatusBadge status={solicitud.status} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">ID de solicitud</div>
              <div className="font-monospace small text-break">{solicitud.id}</div>
            </div>
            {fecha ? (
              <div className="col-md-6">
                <div className="text-secondary small">Última actualización</div>
                <div>{fecha}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Flujo de integración</h3>
        </div>
        <div className="card-body">
          <DevRequestFlowTimeline status={solicitud.status} />
        </div>
      </div>

      <div className="alert alert-primary mb-4" role="status">
        <h4 className="alert-heading h5 mb-2">Qué debes hacer ahora</h4>
        <p className="mb-0">{statusMeta.actionNow}</p>
      </div>

      {solicitud.status === 'rejected' && solicitud.rejectReason ? (
        <div className="alert alert-danger mb-4" role="alert">
          <h4 className="alert-heading h5 mb-2">Motivo de rechazo</h4>
          <p className="mb-0">{solicitud.rejectReason}</p>
        </div>
      ) : null}

      {(solicitud.status === 'pending' || solicitud.status === 'provisioning') && (
        <div className="alert alert-info mb-4">
          Mientras esperas, puedes usar el código de integración con placeholders hasta la activación.
          {solicitud.integration?.entityType ? (
            <span className="d-block mt-1">
              Integración: <strong>{solicitud.integration.entityType}</strong> ({solicitud.integration.stack})
            </span>
          ) : null}
        </div>
      )}

      {solicitud.status === 'active' && isOperatorPreview ? (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Credenciales visibles solo para el integrador</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-4">
              Esta es una vista previa del operador. Las credenciales reales se muestran únicamente al
              integrador autenticado desde el Portal Integrador. El operador puede revisar las credenciales
              desde la Consola Operador.
            </p>
            {id ? (
              <Link to={`/admin/solicitudes/${id}`} className="btn btn-outline-primary">
                Volver a detalle operador
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {solicitud.status === 'active' && !isOperatorPreview ? (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">Credenciales</h3>
            <div className="card-subtitle text-secondary">
              Usa las keys según el tipo de integración o acceso que necesites
            </div>
          </div>
          <div className="card-body">
            {devEstado === 'autenticado' ? (
              <p className="text-secondary small mb-3">Sesión: {usuario?.email}</p>
            ) : (
              <div className="mb-4">
                <p className="text-secondary mb-2">
                  <Link to="/dev/login" state={{ from: `/dev/estado/${id}` }}>
                    Inicia sesión
                  </Link>{' '}
                  con la cuenta que creó la solicitud para cargar las credenciales automáticamente.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} form-control`}
                    style={{ maxWidth: '16rem' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email de contacto"
                  />
                  <button type="button" className="btn btn-primary" onClick={() => void fetchCredenciales(email.trim())}>
                    Obtener credenciales
                  </button>
                </div>
              </div>
            )}

            {credError ? <div className="alert alert-danger">{credError}</div> : null}

            {credencialesCargadas ? (
              <>
                <div className="mb-4 pb-4 border-bottom">
                  <h4 className="h5 mb-3">Para tu backend</h4>
                  <CredField
                    label="URL del middleware"
                    hint="Endpoint base para conectar tu backend con Nexum."
                    value={middlewareUrl}
                  />
                  <CredField
                    label="API Key Integrador"
                    hint="Usa esta key en el backend del sistema cliente para enviar operaciones de creación, actualización o eliminación. Las operaciones sensibles pueden quedar sujetas a aprobación."
                    value={integradorKey}
                  />
                  <CredField
                    label="API Key Lectura"
                    hint="Usa esta key para consultar datos, historial o trazabilidad sin permisos de modificación."
                    value={lecturaKey}
                  />
                </div>

                <div className="alert alert-warning mb-4" role="alert">
                  La API Key Admin no se entrega en el Portal Integrador por seguridad. Las acciones
                  administrativas se realizan desde la Consola Cliente usando usuarios con rol admin.
                </div>
              </>
            ) : null}

            {Object.keys(userPasswords).length > 0 ? (
              <div>
                <h4 className="h5 mb-2">Para tu equipo</h4>
                <p className="text-secondary small mb-3">
                  Estos usuarios permiten acceder a la Consola Cliente. El rol admin puede revisar y
                  aprobar operaciones según la configuración del tenant.
                </p>
                <div className="table-responsive">
                  <table className="table table-sm table-vcenter">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Contraseña temporal</th>
                        <th className="w-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(userPasswords).map(([user, pwd]) => {
                        const rol = rolPorUsuario.get(user)
                        const rolLabel = rol ? (ROL_LABELS[rol] ?? rol) : 'Rol no disponible'
                        return (
                          <tr key={user}>
                            <td>
                              <code>{user}</code>
                            </td>
                            <td>{rolLabel}</td>
                            <td className="font-monospace small">{pwd}</td>
                            <td>
                              <CopyPasswordButton value={pwd} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Link to="/login" className="btn btn-outline-primary btn-sm mt-2">
                  Ir a la consola tenant
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Paquete de integración</h3>
          <div className="card-subtitle text-secondary">Código generado con tu diseño ({stack})</div>
        </div>
        <div className="card-body">
          <IntegrationCodePanel
            ctx={ctx}
            stack={stack}
            keysPending={keysPending}
            showTestButton={!isOperatorPreview && solicitud.status === 'active' && !!integradorKey}
            downloadName={`integracion-${solicitud.tenantId}`}
          />
        </div>
      </div>
    </div>
  )
}

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
import { copyToClipboard } from '../components/onboarding/OnboardingUi'
import { useDevAuth } from '../context/DevAuthContext'
import type { StackTarget } from '../lib/onboardingSnippets'
import {
  getDevCredenciales,
  getDevSolicitud,
  type DevRequestStatus,
  type DevTenantRequest,
} from '../services/devPortalApi'
import '../dev-status.css'

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

function FieldItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="dev-status-field-label">{label}</div>
      <div className={`dev-status-field-value${mono ? ' dev-status-field-value--mono' : ''}`}>{value}</div>
    </div>
  )
}

function RoleBadge({ rol }: { rol: string }) {
  const label = ROL_LABELS[rol] ?? rol
  const tone = rol === 'admin' ? 'admin' : rol === 'integrador' ? 'integrador' : 'lectura'
  return <span className={`dev-status-role-badge dev-status-role-badge--${tone}`}>{label}</span>
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
    <div className="dev-status-copy-field">
      <div className="dev-status-copy-label">{label}</div>
      <p className="dev-status-copy-hint">{hint}</p>
      <div className="dev-status-copy-row">
        <code className="dev-status-copy-value">{value}</code>
        <button type="button" className="dev-status-btn-sm" onClick={handleCopy}>
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
    <button type="button" className="dev-status-btn-sm" onClick={handleCopy}>
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
    return (
      <div className="dev-status-page">
        <div className="dev-status-shell dev-status-loading">Cargando estado…</div>
      </div>
    )
  }

  if (!solicitud) {
    return (
      <div className="dev-status-page">
        <div className="dev-status-shell">
          <div className="dev-status-error-card">
            <div className="dev-status-notice dev-status-notice--danger mb-0">
              {loadError ?? 'Solicitud no encontrada.'}
            </div>
            <div className="dev-status-error-actions">
              <Link to="/dev/mis-solicitudes" className="dev-status-btn-outline">
                Mis solicitudes
              </Link>
              <Link to="/dev" className="dev-status-btn-outline">
                Volver al portal
              </Link>
            </div>
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
    <div className="dev-status-page">
      <div className="dev-status-shell">
        {!isOperatorPreview ? (
          <Link to="/dev/mis-solicitudes" className="dev-status-back">
            ← Mis solicitudes
          </Link>
        ) : null}

        {isOperatorPreview ? (
          <div className="dev-status-notice dev-status-notice--warn" role="status">
            <strong>Vista previa de operador:</strong> estás viendo cómo se presentará esta solicitud al integrador.
            Esta vista no cambia permisos ni inicia sesión como dev.
            {id ? (
              <div className="dev-status-callout-action">
                <Link to={`/admin/solicitudes/${id}`} className="dev-status-btn-outline">
                  ← Volver a Consola Operador
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="dev-status-header">
          <div className="dev-status-title-row">
            <h1 className="dev-status-title">{solicitud.orgName}</h1>
            <DevRequestStatusBadge status={solicitud.status} />
          </div>
          <div className="dev-status-meta">
            <span>
              tenant_id: <code>{solicitud.tenantId}</code>
            </span>
            {fecha ? <span>Actualizado: {fecha}</span> : null}
          </div>
        </div>

        <section className="dev-status-section">
          <div className="dev-status-section-header">
            <h2 className="dev-status-section-title">Resumen de solicitud</h2>
          </div>
          <div className="dev-status-section-body">
            <div className="dev-status-field-grid">
              <FieldItem label="Organización" value={solicitud.orgName} />
              <FieldItem label="Tenant ID" value={solicitud.tenantId} mono />
              <div>
                <div className="dev-status-field-label">Estado actual</div>
                <DevRequestStatusBadge status={solicitud.status} />
              </div>
              <FieldItem label="ID de solicitud" value={solicitud.id} mono />
            </div>
          </div>
        </section>

        <section className="dev-status-section">
          <div className="dev-status-section-header">
            <h2 className="dev-status-section-title">Flujo de integración</h2>
          </div>
          <div className="dev-status-section-body">
            <DevRequestFlowTimeline status={solicitud.status} />
          </div>
        </section>

        <div className="dev-status-notice dev-status-notice--primary" role="status">
          <h3 className="dev-status-notice-title">Qué debes hacer ahora</h3>
          <p className="dev-status-notice-text">{statusMeta.actionNow}</p>
        </div>

        {solicitud.status === 'rejected' && solicitud.rejectReason ? (
          <div className="dev-status-notice dev-status-notice--danger" role="alert">
            <h3 className="dev-status-notice-title">Motivo de rechazo</h3>
            <p className="dev-status-notice-text mb-0">{solicitud.rejectReason}</p>
          </div>
        ) : null}

        {(solicitud.status === 'pending' || solicitud.status === 'provisioning') && (
          <div className="dev-status-notice dev-status-notice--info">
            Mientras esperas, puedes usar el código de integración con placeholders hasta la activación.
            {solicitud.integration?.entityType ? (
              <span className="d-block mt-1">
                Integración: <strong>{solicitud.integration.entityType}</strong> ({solicitud.integration.stack})
              </span>
            ) : null}
          </div>
        )}

        {solicitud.status === 'active' && isOperatorPreview ? (
          <section className="dev-status-section">
            <div className="dev-status-section-header">
              <h2 className="dev-status-section-title">Credenciales visibles solo para el integrador</h2>
            </div>
            <div className="dev-status-section-body">
              <p className="dev-status-copy-hint mb-3">
                Esta es una vista previa del operador. Las credenciales reales se muestran únicamente al integrador
                autenticado desde el Portal Integrador. El operador puede revisar las credenciales desde la Consola
                Operador.
              </p>
              {id ? (
                <Link to={`/admin/solicitudes/${id}`} className="dev-status-btn-outline">
                  Volver a detalle operador
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {solicitud.status === 'active' && !isOperatorPreview ? (
          <section className="dev-status-section">
            <div className="dev-status-section-header">
              <h2 className="dev-status-section-title">Credenciales</h2>
              <p className="dev-status-section-subtitle">
                Usa las keys según el tipo de integración o acceso que necesites
              </p>
            </div>
            <div className="dev-status-section-body">
              {devEstado === 'autenticado' ? (
                <p className="dev-status-session">Sesión: {usuario?.email}</p>
              ) : (
                <div className="mb-3">
                  <p className="dev-status-copy-hint mb-2">
                    <Link to="/dev/login" state={{ from: `/dev/estado/${id}` }}>
                      Inicia sesión
                    </Link>{' '}
                    con la cuenta que creó la solicitud para cargar las credenciales automáticamente.
                  </p>
                  <div className="dev-status-cred-actions">
                    <input
                      className="dev-status-input form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email de contacto"
                    />
                    <button
                      type="button"
                      className="dev-status-btn-primary"
                      onClick={() => void fetchCredenciales(email.trim())}
                    >
                      Obtener credenciales
                    </button>
                  </div>
                </div>
              )}

              {credError ? (
                <div className="dev-status-notice dev-status-notice--danger">{credError}</div>
              ) : null}

              {credencialesCargadas ? (
                <>
                  <div className="dev-status-divider" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                    <h3 className="dev-status-subtitle">Para tu backend</h3>
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

                  <div className="dev-status-notice dev-status-notice--warn">
                    La API Key Admin no se entrega en el Portal Integrador por seguridad. Las acciones administrativas
                    se realizan desde la Consola Cliente usando usuarios con rol admin.
                  </div>
                </>
              ) : null}

              {Object.keys(userPasswords).length > 0 ? (
                <div className="dev-status-divider">
                  <h3 className="dev-status-subtitle">Para tu equipo</h3>
                  <p className="dev-status-copy-hint mb-3">
                    Estos usuarios permiten acceder a la Consola Cliente. El rol admin puede revisar y aprobar
                    operaciones según la configuración del tenant.
                  </p>
                  <div className="dev-status-table-wrap">
                    <table className="dev-status-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Contraseña temporal</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(userPasswords).map(([user, pwd]) => {
                          const rol = rolPorUsuario.get(user)
                          const rolLabel = rol ? (ROL_LABELS[rol] ?? rol) : 'Rol no disponible'
                          return (
                            <tr key={user}>
                              <td className="dev-status-cell-mono">{user}</td>
                              <td>
                                {rol ? <RoleBadge rol={rol} /> : rolLabel}
                              </td>
                              <td className="dev-status-cell-mono">{pwd}</td>
                              <td>
                                <CopyPasswordButton value={pwd} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Link to="/login" className="dev-status-btn-outline mt-3 d-inline-flex">
                    Ir a la consola tenant
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="dev-status-section">
          <div className="dev-status-section-header">
            <h2 className="dev-status-section-title">Paquete de integración</h2>
            <p className="dev-status-section-subtitle">Código generado con tu diseño ({stack})</p>
          </div>
          <div className="dev-status-section-body dev-status-code-panel">
            <IntegrationCodePanel
              ctx={ctx}
              stack={stack}
              keysPending={keysPending}
              showTestButton={!isOperatorPreview && solicitud.status === 'active' && !!integradorKey}
              downloadName={`integracion-${solicitud.tenantId}`}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

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

function RoleBadge({ rol }: { rol: string }) {
  const label = ROL_LABELS[rol] ?? rol
  const tone =
    rol === 'admin' ? 'admin' : rol === 'integrador' ? 'integrador' : 'lectura'
  return <span className={`operador-role-badge operador-role-badge--${tone}`}>{label}</span>
}

function UserStateBadge({ status }: { status: DevRequestStatus }) {
  if (status === 'active') {
    return <span className="operador-state-badge operador-state-badge--ok">Activo</span>
  }
  if (status === 'rejected') {
    return <span className="operador-state-badge operador-state-badge--muted">No creado</span>
  }
  return <span className="operador-state-badge operador-state-badge--pending">Pendiente de activación</span>
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
    <div className="operador-copy-field">
      <div className="operador-copy-field-label">{label}</div>
      {hint ? <p className="operador-copy-field-hint">{hint}</p> : null}
      <div className="operador-copy-row">
        <code className="operador-copy-value">{value}</code>
        <button type="button" className="operador-btn-sm" onClick={handleCopy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

function FieldItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="operador-field-label">{label}</div>
      <div className={`operador-field-value${mono ? ' operador-field-value--mono' : ''}`}>{value}</div>
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
  const [payloadCopied, setPayloadCopied] = useState(false)

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

  const copyPayload = (text: string) => {
    copyToClipboard(text)
    setPayloadCopied(true)
    window.setTimeout(() => setPayloadCopied(false), 2000)
  }

  if (!solicitud && !error) {
    return <div className="operador-page operador-loading">Cargando…</div>
  }

  if (!solicitud) {
    return (
      <div className="operador-page">
        <div className="operador-notice operador-notice--danger">{error}</div>
        <Link to="/admin/solicitudes" className="operador-btn-outline">
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
    <div className="operador-page">
      <Link to="/admin/solicitudes" className="operador-back-link">
        ← Solicitudes de integración
      </Link>

      <div className="operador-detail-header">
        <div className="operador-detail-title-row">
          <h1 className="operador-detail-title">{solicitud.orgName}</h1>
          <DevRequestStatusBadge status={solicitud.status} />
        </div>
        <div className="operador-detail-meta">
          <span>
            tenant_id: <code>{solicitud.tenantId}</code>
          </span>
          <span>{solicitud.contactEmail}</span>
        </div>
      </div>

      <section className="operador-section">
        <div className="operador-section-header">
          <h2 className="operador-section-title">Resumen de solicitud</h2>
        </div>
        <div className="operador-section-body">
          <div className="operador-field-grid">
            <FieldItem label="Organización" value={solicitud.orgName} />
            <FieldItem label="Tenant ID" value={solicitud.tenantId} mono />
            <div>
              <div className="operador-field-label">Estado</div>
              <DevRequestStatusBadge status={solicitud.status} />
            </div>
            <FieldItem label="Contacto integrador" value={solicitud.contactEmail} />
            {fecha ? <FieldItem label="Última actualización" value={fecha} /> : null}
            <FieldItem label="ID solicitud" value={solicitud.id} mono />
            {solicitud.domain ? <FieldItem label="Dominio" value={solicitud.domain} /> : null}
          </div>
        </div>
      </section>

      <section className="operador-section">
        <div className="operador-section-header">
          <h2 className="operador-section-title">Datos de integración</h2>
        </div>
        <div className="operador-section-body">
          <div className="operador-field-grid">
            <FieldItem label="Entidad" value={integ?.entityName || '—'} />
            <FieldItem label="Campo identificador" value={integ?.businessIdField || '—'} mono />
            <FieldItem label="Tipo de dato" value={integ?.entityType || '—'} />
            <FieldItem label="Stack elegido" value={integ?.stack || '—'} />
          </div>
          <div className="operador-payload-block">
            <div className="operador-payload-head">
              <span className="operador-payload-label">Payload</span>
              {integ?.payloadExample ? (
                <button
                  type="button"
                  className="operador-btn-sm"
                  onClick={() => copyPayload(integ.payloadExample ?? '')}
                >
                  {payloadCopied ? 'Copiado' : 'Copiar payload'}
                </button>
              ) : null}
            </div>
            {integ?.payloadExample ? (
              <pre className="operador-code-block">{integ.payloadExample}</pre>
            ) : (
              <p className="operador-empty-text">No se adjuntó payload de ejemplo.</p>
            )}
          </div>
        </div>
      </section>

      <section className="operador-section">
        <div className="operador-section-header">
          <h2 className="operador-section-title">Usuarios solicitados para consola</h2>
        </div>
        <div className="operador-table-wrap">
          <table className="operador-table">
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
                  <td className="operador-cell-mono">{u.username}</td>
                  <td>{u.nombreCompleto}</td>
                  <td>
                    <RoleBadge rol={u.rol} />
                  </td>
                  <td>
                    <UserStateBadge status={status} />
                  </td>
                </tr>
              ))}
              {solicitud.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="operador-cell-muted" style={{ textAlign: 'center', padding: '1rem' }}>
                    Sin usuarios definidos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="operador-section">
        <div className="operador-section-header">
          <h2 className="operador-section-title">Decisión del operador</h2>
        </div>
        <div className="operador-section-body">
          {error ? <div className="operador-notice operador-notice--danger">{error}</div> : null}

          {status === 'pending' ? (
            <>
              <p className="operador-help-text">
                Revisa la solicitud y aprueba para pasar a provisioning, o recházala si no cumple los requisitos.
              </p>
              <div className="operador-actions mb-3">
                <button
                  type="button"
                  disabled={busy}
                  className="operador-btn-action operador-btn-action--primary"
                  onClick={() => void runAction(async () => { await marcarProvisioning(solicitud.id) })}
                >
                  Aprobar (pasar a provisioning)
                </button>
              </div>
              <div className="operador-divider">
                <label className="form-label">Motivo de rechazo</label>
                <input className="form-control operador-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <button
                  type="button"
                  disabled={busy}
                  className="operador-btn-action operador-btn-action--danger mt-2"
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
              <p className="operador-help-text">
                Completa la configuración técnica y activa el tenant para generar credenciales.
              </p>
              <div className="operador-actions">
                <button
                  type="button"
                  disabled={busy || !checklist.canal}
                  className="operador-btn-action operador-btn-action--warn"
                  onClick={() => void runAction(async () => {
                    const res = await activarSolicitud(solicitud.id)
                    setResultado(res)
                    guardarResultado(solicitud.id, res)
                  })}
                >
                  Activar tenant
                </button>
              </div>
              {!checklist.canal ? (
                <p className="operador-help-text mt-2 mb-0">
                  Marca el checklist de canal Fabric en «Avanzado técnico» antes de activar.
                </p>
              ) : null}
            </>
          ) : null}

          {status === 'active' ? (
            <div className="operador-notice operador-notice--success mb-0">
              <strong>Tenant activo.</strong> El integrador puede consultar su estado y credenciales permitidas desde
              el Portal Integrador.
            </div>
          ) : null}

          {status === 'rejected' ? (
            <div className="operador-notice operador-notice--danger mb-0">
              <strong>Solicitud rechazada.</strong> {solicitud.rejectReason || 'Sin motivo registrado.'}
            </div>
          ) : null}
        </div>
      </section>

      {status === 'active' && credenciales ? (
        <section className="operador-section operador-section--success">
          <div className="operador-section-header">
            <h2 className="operador-section-title">Credenciales generadas</h2>
          </div>
          <div className="operador-section-body">
            <CopyField label="URL middleware" value={credenciales.middlewareUrl} />
            {keyOrder.map((rol) => {
              const key = credenciales.apiKeys[rol]
              if (!key) return null
              const meta = KEY_HINTS[rol]
              return <CopyField key={rol} label={meta.label} hint={meta.hint} value={key} />
            })}
            {Object.entries(credenciales.apiKeys)
              .filter(([rol]) => !keyOrder.includes(rol as (typeof keyOrder)[number]))
              .map(([rol, key]) => (
                <CopyField key={rol} label={`API Key ${rol}`} value={key} />
              ))}

            {Object.keys(credenciales.userPasswords).length > 0 ? (
              <div className="operador-divider">
                <h3 className="operador-section-title mb-3">Usuarios de consola</h3>
                <div className="operador-table-wrap">
                  <table className="operador-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Contraseña temporal</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(credenciales.userPasswords).map(([user, pwd]) => (
                        <tr key={user}>
                          <td className="operador-cell-mono">{user}</td>
                          <td className="operador-cell-mono">{pwd}</td>
                          <td>
                            <button
                              type="button"
                              className="operador-btn-sm"
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

            <p className="operador-help-text mt-2 mb-2">
              El integrador solo verá las keys Integrador y Lectura en el Portal Integrador.
            </p>
            <Link
              to={`/admin/solicitudes/${solicitud.id}/preview-integrador`}
              className="operador-btn-outline"
            >
              Previsualizar vista del integrador
            </Link>
          </div>
        </section>
      ) : status === 'active' && !credenciales ? (
        <section className="operador-section">
          <div className="operador-section-body">
            <p className="operador-help-text mb-0">
              Las credenciales se mostraron al activar el tenant en esta consola. Si necesitas consultarlas de nuevo,
              revisa el registro de la sesión de activación o vuelve a cargar tras activar en el mismo navegador.
            </p>
            <Link
              to={`/admin/solicitudes/${solicitud.id}/preview-integrador`}
              className="operador-btn-outline mt-3 d-inline-flex"
            >
              Previsualizar vista del integrador
            </Link>
          </div>
        </section>
      ) : null}

      {(status === 'pending' || status === 'provisioning') && (
        <section className="operador-section">
          <div className="operador-section-header">
            <button
              type="button"
              className="operador-collapse-toggle"
              onClick={() => setAvanzadoAbierto((v) => !v)}
              aria-expanded={avanzadoAbierto}
            >
              <h2 className="operador-section-title">
                Avanzado técnico {avanzadoAbierto ? '▾' : '▸'}
              </h2>
              <p className="operador-section-subtitle">
                Información técnica para soporte, depuración o defensa del proyecto.
              </p>
            </button>
          </div>
          {avanzadoAbierto ? (
            <div className="operador-section-body">
              <p className="operador-help-text">Ejecuta en la red Hyperledger antes de activar:</p>
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
        </section>
      )}
    </div>
  )
}

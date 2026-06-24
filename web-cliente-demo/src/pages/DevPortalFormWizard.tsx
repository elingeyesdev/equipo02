import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'
import {
  PAYLOAD_TEMPLATES,
  withAttributeIds,
  type AttributeDraft,
} from '../lib/onboardingTemplates'
import {
  buildCurlExamples,
  buildIntegratorGuideMarkdown,
  buildMappingTable,
  type StackTarget,
} from '../lib/onboardingSnippets'
import { copyToClipboard, downloadTextFile } from '../components/onboarding/OnboardingUi'
import {
  draftToIntegrationAttributes,
  slugFromOrgName,
  upsertDevSolicitud,
  type DevRequestUser,
} from '../services/devPortalApi'

const STEP_LABELS = ['Organización', 'Contacto', 'Usuarios', 'Modelo on-chain', 'Revisión'] as const

const DEFAULT_USERS: DevRequestUser[] = [
  { username: 'admin', nombreCompleto: 'Administrador', rol: 'admin' },
  { username: 'integrador', nombreCompleto: 'Integrador API', rol: 'integrador' },
]

const ROLE_CARDS = [
  {
    title: 'Admin',
    desc: 'Aprueba cambios, audita operaciones y gestiona el tenant.',
  },
  {
    title: 'Integrador',
    desc: 'Propone altas, ediciones, bajas o restauraciones vía API.',
  },
  {
    title: 'Lectura',
    desc: 'Consulta registros e historial sin modificar información.',
  },
] as const

const REFERENCE_PAYLOAD = `{
  "schemaVersion": "v1",
  "campo_de_tu_sistema": "valor",
  "estado": "activo"
}`

const GENERIC_PAYLOAD_REFERENCE = `{
  "schemaVersion": "v1",
  "identificador": "ID-001",
  "descripcion": "Registro de ejemplo",
  "estado": "activo",
  "actividades": [
    {
      "id": "ACT-1",
      "nombre": "Actividad 1",
      "fecha": "2026-06-12"
    },
    {
      "id": "ACT-2",
      "nombre": "Actividad 2",
      "fecha": "2026-06-15"
    }
  ],
  "producciones": [
    {
      "id": "PROD-1",
      "tipo": "producto_a",
      "cantidad": 120,
      "unidad": "kg"
    },
    {
      "id": "PROD-2",
      "tipo": "producto_b",
      "cantidad": 80,
      "unidad": "kg"
    }
  ],
  "sincronizadoEn": "2026-06-12T00:00:00Z"
}`

const JSON_PLACEHOLDER = REFERENCE_PAYLOAD

function WizardField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  id,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  id?: string
}) {
  const fieldId = id ?? label.toLowerCase().replace(/\W+/g, '-')
  return (
    <label className="form-label mb-0" htmlFor={fieldId}>
      {label}
      <input
        id={fieldId}
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint ? <span className="dev-wizard-field-hint">{hint}</span> : null}
    </label>
  )
}

export default function DevPortalFormWizard() {
  const navigate = useNavigate()
  const { estado: devEstado, usuario } = useDevAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [orgName, setOrgName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [tenantTouched, setTenantTouched] = useState(false)
  const [domain, setDomain] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [users, setUsers] = useState<DevRequestUser[]>(DEFAULT_USERS)

  const [entityName, setEntityName] = useState('Lote')
  const [businessIdField, setBusinessIdField] = useState('codigo_trazabilidad')
  const [entityType, setEntityType] = useState('lote')
  const [schemaVersion, setSchemaVersion] = useState('v1')
  const [attributes] = useState<AttributeDraft[]>(() =>
    withAttributeIds(PAYLOAD_TEMPLATES[0].attributes),
  )
  const [payloadExampleText, setPayloadExampleText] = useState(REFERENCE_PAYLOAD)
  const [stack, setStack] = useState<StackTarget>('laravel')
  const [showPayloadReference, setShowPayloadReference] = useState(false)

  const progressPct = ((step + 1) / STEP_LABELS.length) * 100

  const jsonParseError = useMemo(() => {
    const trimmed = payloadExampleText.trim()
    if (!trimmed) return null
    try {
      JSON.parse(trimmed)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'JSON inválido'
    }
  }, [payloadExampleText])

  const ctx = useMemo(
    () => ({
      baseUrl: 'http://localhost:3000',
      apiKey: `${tenantId || 'tu-tenant'}-integrador-PENDIENTE`,
      apiKeyRole: 'integrador' as const,
      entityName,
      businessIdField,
      entityType,
      schemaVersion,
      payloadExampleText,
    }),
    [tenantId, entityName, businessIdField, entityType, schemaVersion, payloadExampleText],
  )

  const mappingTable = useMemo(() => buildMappingTable(ctx), [ctx])
  const curlExamples = useMemo(() => buildCurlExamples(ctx), [ctx])
  const guideMd = useMemo(
    () => buildIntegratorGuideMarkdown(ctx, curlExamples, ''),
    [ctx, curlExamples],
  )

  const emailEnvio = (usuario?.email ?? contactEmail).trim()
  const usuariosFiltrados = users.filter((u) => u.username.trim())
  const stackLabel =
    stack === 'laravel' ? 'Laravel / PHP' : stack === 'nodejs' ? 'Node.js' : 'cURL (referencia manual)'

  const onOrgNameChange = (v: string) => {
    setOrgName(v)
    if (!tenantTouched) setTenantId(slugFromOrgName(v))
  }

  const addUser = () => setUsers((u) => [...u, { username: '', nombreCompleto: '', rol: 'lectura' }])
  const updateUser = (idx: number, patch: Partial<DevRequestUser>) => {
    setUsers((list) => list.map((u, i) => (i === idx ? { ...u, ...patch } : u)))
  }
  const removeUser = (idx: number) => setUsers((list) => list.filter((_, i) => i !== idx))

  const formatJson = () => {
    try {
      const parsed = JSON.parse(payloadExampleText)
      setPayloadExampleText(JSON.stringify(parsed, null, 2))
    } catch {
      /* mantiene el texto actual; el error ya se muestra en la UI */
    }
  }

  const submit = async () => {
    if (devEstado !== 'autenticado') {
      navigate('/dev/login', { state: { from: '/dev/solicitud' } })
      return
    }
    setSaving(true)
    setError(null)
    try {
      const solicitud = await upsertDevSolicitud({
        tenantId: tenantId.trim(),
        orgName: orgName.trim(),
        domain: domain.trim(),
        contactEmail: usuario?.email ?? contactEmail.trim(),
        users: users.filter((u) => u.username.trim()),
        integration: {
          entityName,
          businessIdField,
          entityType,
          schemaVersion,
          attributes: draftToIntegrationAttributes(attributes),
          payloadExample: payloadExampleText,
          stack,
        },
        submit: true,
      })
      navigate(`/dev/estado/${solicitud.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar solicitud')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dev-wizard-shell">
      <div className="dev-wizard-progress-wrap">
        <div className="dev-wizard-progress-bar">
          <div className="dev-wizard-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="dev-wizard-stepper" aria-label="Progreso del formulario">
          {STEP_LABELS.map((label, idx) => (
            <span
              key={label}
              className={`dev-wizard-stepper-item${idx === step ? ' is-active' : ''}${idx < step ? ' is-done' : ''}`}
            >
              <span className="dev-wizard-stepper-num">{idx < step ? '✓' : idx + 1}</span>
              {label}
            </span>
          ))}
        </div>
        <p className="dev-wizard-step-mobile">
          Paso {step + 1} de {STEP_LABELS.length}: {STEP_LABELS[step]}
        </p>
      </div>

      <section className="dev-wizard-card">
        {step === 0 ? (
          <div>
            <h2 className="dev-wizard-step-title">Datos de la organización</h2>
            <p className="dev-wizard-step-desc">
              Define cómo se identificará tu organización dentro de Nexum.
            </p>
            <div className="dev-wizard-section">
              <div className="dev-wizard-grid dev-wizard-grid--2">
                <WizardField label="Nombre comercial" value={orgName} onChange={onOrgNameChange} />
                <WizardField
                  label="tenant_id"
                  value={tenantId}
                  onChange={(v) => {
                    setTenantTouched(true)
                    setTenantId(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }}
                  hint="El tenant_id será el identificador técnico de tu organización. Debe ser único y estable."
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="dev-wizard-step-title">Contacto de la organización</h2>
            <p className="dev-wizard-step-desc">
              Indica a quién debe contactar Nexum para revisar y aprobar la solicitud.
            </p>
            <p className="dev-wizard-field-hint" style={{ marginTop: '0.5rem' }}>
              Estos datos son operativos. No configuran la blockchain todavía.
            </p>
            <div className="dev-wizard-section">
              <div className="dev-wizard-grid dev-wizard-grid--2">
                <WizardField
                  label="Dominio web"
                  value={domain}
                  onChange={setDomain}
                  placeholder="https://agro.tuempresa.com"
                  hint="URL base de tu sistema. Referencia operativa para Nexum."
                />
                <WizardField
                  label="Email de contacto"
                  value={contactEmail}
                  onChange={setContactEmail}
                  placeholder="integracion@tuempresa.com"
                  hint="Canal para notificaciones de la solicitud y entrega de credenciales."
                />
              </div>
              {devEstado === 'autenticado' && usuario?.email ? (
                <p className="dev-wizard-session-hint">
                  Se usará{' '}
                  <a href={`mailto:${usuario.email}`} className="text-reset">
                    {usuario.email}
                  </a>{' '}
                  como contacto principal de la sesión si no indicas otro correo.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="dev-wizard-step-title">Usuarios de la Consola Cliente</h2>
            <p className="dev-wizard-step-desc">
              Solicita las cuentas que necesitarás para operar, aprobar o consultar evidencia en Nexum.
            </p>
            <div className="dev-wizard-role-cards">
              {ROLE_CARDS.map((role) => (
                <div key={role.title} className="dev-wizard-role-card">
                  <strong>{role.title}</strong>
                  <p>{role.desc}</p>
                </div>
              ))}
            </div>
            <div className="dev-wizard-users-head">
              <h3 className="dev-wizard-users-title">Usuarios solicitados</h3>
              <button type="button" className="dev-wizard-add-user" onClick={addUser}>
                + Agregar usuario
              </button>
            </div>
            {users.map((u, idx) => (
              <div key={idx} className="dev-wizard-user-row">
                <div className="dev-wizard-user-grid">
                  <label className="form-label mb-0">
                    Usuario
                    <input
                      className="form-control"
                      value={u.username}
                      placeholder="admin"
                      onChange={(e) => updateUser(idx, { username: e.target.value })}
                    />
                  </label>
                  <label className="form-label mb-0">
                    Nombre completo
                    <input
                      className="form-control"
                      value={u.nombreCompleto}
                      placeholder="Nombre visible"
                      onChange={(e) => updateUser(idx, { nombreCompleto: e.target.value })}
                    />
                  </label>
                  <label className="form-label mb-0">
                    Rol en consola
                    <select
                      className="form-select"
                      value={u.rol}
                      onChange={(e) => updateUser(idx, { rol: e.target.value as DevRequestUser['rol'] })}
                    >
                      <option value="admin">admin</option>
                      <option value="integrador">integrador</option>
                      <option value="lectura">lectura</option>
                    </select>
                  </label>
                  <button type="button" className="dev-wizard-user-remove" onClick={() => removeUser(idx)}>
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="dev-wizard-step-title">Tu entidad en blockchain</h2>
            <p className="dev-wizard-step-desc">
              Define qué registro de tu sistema se guardará en Nexum, con qué ID y qué payload representará cada
              versión.
            </p>
            <div className="dev-wizard-notice">
              En este paso no conectas tu API todavía. Solo defines qué dato de tu sistema se guardará en blockchain y
              cómo se mapeará a datoId, tipo y payload.
            </div>

            <div className="dev-wizard-section">
              <h3 className="dev-wizard-section-title">Qué vas a registrar</h3>
              <WizardField
                label="Nombre de tu entidad"
                value={entityName}
                onChange={setEntityName}
                placeholder="Lote"
                hint="Modelo principal que quieres certificar en cadena. Ej. Lote, Factura, Paciente."
              />
            </div>

            <div className="dev-wizard-section">
              <h3 className="dev-wizard-section-title">Cómo se identificará en Nexum</h3>
              <div className="dev-wizard-grid dev-wizard-grid--2">
                <WizardField
                  label="Campo ID de negocio → datoId"
                  value={businessIdField}
                  onChange={setBusinessIdField}
                  placeholder="codigo_trazabilidad"
                  hint="Debe venir de un campo único y estable de tu sistema. Se usará para consultar historial y auditoría."
                />
                <WizardField
                  label="tipo"
                  value={entityType}
                  onChange={setEntityType}
                  placeholder="lote"
                  hint="Etiqueta libre para clasificar registros dentro del tenant. Ej. lote, factura, paciente."
                />
                <WizardField
                  label="schemaVersion"
                  value={schemaVersion}
                  onChange={setSchemaVersion}
                  placeholder="v1"
                  hint="Versión del formato del payload. Ej. v1."
                />
              </div>
            </div>

            <div className="dev-wizard-section">
              <h3 className="dev-wizard-section-title">Payload que enviará tu backend</h3>
              <p className="dev-wizard-field-hint" style={{ marginTop: '0.35rem' }}>
                Escribe un ejemplo realista del objeto que tu backend enviará a Nexum en POST/PUT /datos. Este JSON
                representa el snapshot del registro que quedará como evidencia.
              </p>
              <p className="dev-wizard-field-hint">
                Usa <strong>Ver ejemplo</strong> para ver un payload genérico de referencia. Edita{' '}
                <strong>Tu payload JSON</strong> con los campos reales de tu sistema.
              </p>
              <div className="dev-wizard-json-head">
                <span className="form-label mb-0">Tu payload JSON</span>
                <div className="dev-wizard-json-actions">
                  <button
                    type="button"
                    className={`dev-wizard-json-btn${showPayloadReference ? ' is-active' : ''}`}
                    onClick={() => setShowPayloadReference((v) => !v)}
                    aria-expanded={showPayloadReference}
                  >
                    {showPayloadReference ? 'Ocultar ejemplo' : 'Ver ejemplo'}
                  </button>
                  <button type="button" className="dev-wizard-json-btn" onClick={formatJson}>
                    Formatear JSON
                  </button>
                  <button
                    type="button"
                    className="dev-wizard-json-btn"
                    onClick={() => copyToClipboard(payloadExampleText)}
                  >
                    Copiar
                  </button>
                </div>
              </div>
              {showPayloadReference ? (
                <div className="dev-wizard-json-reference">
                  <p className="dev-wizard-json-reference-note">
                    Ejemplo genérico de referencia. Escríbe tu propio JSON en el campo de abajo con los campos reales de
                    tu entidad.
                  </p>
                  <pre className="dev-wizard-json-reference-code">{GENERIC_PAYLOAD_REFERENCE}</pre>
                </div>
              ) : null}
              <textarea
                className={`dev-wizard-json-editor${jsonParseError ? ' is-error' : ''}${!jsonParseError && payloadExampleText.trim() ? ' is-valid' : ''}`}
                value={payloadExampleText}
                onChange={(e) => setPayloadExampleText(e.target.value)}
                placeholder={JSON_PLACEHOLDER}
                spellCheck={false}
                aria-label="Tu payload JSON"
              />
              {jsonParseError ? (
                <p className="dev-wizard-json-error">El payload debe ser un JSON válido.</p>
              ) : payloadExampleText.trim() ? (
                <p className="dev-wizard-json-ok">JSON válido</p>
              ) : null}
            </div>

            <div className="dev-wizard-section">
              <h3 className="dev-wizard-section-title">Resumen del mapeo</h3>
              <div className="dev-wizard-mapping">
                <dl className="dev-wizard-mapping-dl">
                  <div>
                    <dt>Entidad</dt>
                    <dd>{entityName.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>datoId</dt>
                    <dd>{businessIdField.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>tipo</dt>
                    <dd>{entityType.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>schemaVersion</dt>
                    <dd>{schemaVersion.trim() || '—'}</dd>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <dt>payload</dt>
                    <dd>JSON libre</dd>
                  </div>
                </dl>
                <table className="dev-wizard-mapping-table">
                  <thead>
                    <tr>
                      <th>Tu sistema</th>
                      <th>Nexum</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>campo único</td>
                      <td>datoId</td>
                    </tr>
                    <tr>
                      <td>etiqueta</td>
                      <td>tipo</td>
                    </tr>
                    <tr>
                      <td>snapshot JSON</td>
                      <td>payload</td>
                    </tr>
                  </tbody>
                </table>
                <button
                  type="button"
                  className="dev-wizard-json-btn mt-2"
                  onClick={() => copyToClipboard(mappingTable)}
                >
                  Copiar resumen
                </button>
              </div>
            </div>

            <div className="dev-wizard-section">
              <h3 className="dev-wizard-section-title">Stack del backend</h3>
              <select className="form-select" value={stack} onChange={(e) => setStack(e.target.value as StackTarget)}>
                <option value="laravel">Laravel / PHP</option>
                <option value="nodejs">Node.js</option>
                <option value="curl">cURL (solo pruebas manuales)</option>
              </select>
              <span className="dev-wizard-field-hint">
                Referencia para que Nexum prepare ejemplos de integración después de aprobar la solicitud. Esto no
                configura la API todavía.
              </span>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <h2 className="dev-wizard-step-title">Revisión de la solicitud</h2>
            <p className="dev-wizard-step-desc">Verifica los datos antes de enviar tu solicitud a Nexum.</p>

            <div className="dev-wizard-section">
              <div className="dev-wizard-review-block">
                <div className="dev-wizard-review-head">
                  <h3 className="dev-wizard-review-title">Organización</h3>
                  <button type="button" className="dev-wizard-review-edit" onClick={() => setStep(0)}>
                    Editar
                  </button>
                </div>
                <div className="dev-wizard-review-body">
                  <p>
                    <strong>{orgName.trim() || '—'}</strong>
                  </p>
                  <p className="font-monospace text-muted" style={{ fontSize: '0.75rem' }}>
                    tenant_id: {tenantId.trim() || '—'}
                  </p>
                </div>
              </div>

              <div className="dev-wizard-review-block">
                <div className="dev-wizard-review-head">
                  <h3 className="dev-wizard-review-title">Contacto</h3>
                  <button type="button" className="dev-wizard-review-edit" onClick={() => setStep(1)}>
                    Editar
                  </button>
                </div>
                <div className="dev-wizard-review-body">
                  <p>Dominio: {domain.trim() || '—'}</p>
                  <p>Email: {emailEnvio || '—'}</p>
                </div>
              </div>

              <div className="dev-wizard-review-block">
                <div className="dev-wizard-review-head">
                  <h3 className="dev-wizard-review-title">Usuarios</h3>
                  <button type="button" className="dev-wizard-review-edit" onClick={() => setStep(2)}>
                    Editar
                  </button>
                </div>
                <div className="dev-wizard-review-body">
                  {usuariosFiltrados.length === 0 ? (
                    <p className="text-muted mb-0">Ninguno definido</p>
                  ) : (
                    usuariosFiltrados.map((u) => (
                      <p key={u.username}>
                        {u.username} · {u.rol}
                        {u.nombreCompleto ? ` (${u.nombreCompleto})` : ''}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="dev-wizard-review-block">
                <div className="dev-wizard-review-head">
                  <h3 className="dev-wizard-review-title">Modelo on-chain</h3>
                  <button type="button" className="dev-wizard-review-edit" onClick={() => setStep(3)}>
                    Editar
                  </button>
                </div>
                <div className="dev-wizard-review-body">
                  <p>
                    Entidad <strong>{entityName}</strong> · datoId desde{' '}
                    <code style={{ fontSize: '0.75rem' }}>{businessIdField}</code>
                  </p>
                  <p>
                    tipo: <code style={{ fontSize: '0.75rem' }}>{entityType}</code> · schema:{' '}
                    <code style={{ fontSize: '0.75rem' }}>{schemaVersion}</code>
                  </p>
                </div>
              </div>

              <div className="dev-wizard-review-block">
                <div className="dev-wizard-review-head">
                  <h3 className="dev-wizard-review-title">Stack</h3>
                  <button type="button" className="dev-wizard-review-edit" onClick={() => setStep(3)}>
                    Editar
                  </button>
                </div>
                <div className="dev-wizard-review-body">
                  <p className="mb-0">{stackLabel}</p>
                </div>
              </div>
            </div>

            {devEstado !== 'autenticado' ? (
              <div className="dev-wizard-alert dev-wizard-alert--warn">
                <Link to="/dev/login" className="fw-semibold">
                  Inicia sesión
                </Link>{' '}
                para enviar la solicitud.
              </div>
            ) : null}
            {error ? <div className="dev-wizard-alert dev-wizard-alert--error">{error}</div> : null}

            <div className="dev-wizard-submit-row">
              <button
                type="button"
                className="dev-wizard-btn dev-wizard-btn--primary"
                disabled={saving || devEstado !== 'autenticado'}
                onClick={submit}
              >
                {saving ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              <button
                type="button"
                className="dev-wizard-download-link"
                onClick={() => downloadTextFile(`integracion-${tenantId || 'tenant'}.md`, guideMd)}
              >
                Descargar borrador de integración (.md)
              </button>
            </div>
            <p className="dev-wizard-submit-hint">
              Tras enviar, Nexum revisará tu solicitud y te entregará credenciales cuando apruebe el tenant.
            </p>
          </div>
        ) : null}

        {step < STEP_LABELS.length - 1 ? (
          <div className="dev-wizard-footer">
            <button
              type="button"
              className="dev-wizard-btn dev-wizard-btn--secondary"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="dev-wizard-btn dev-wizard-btn--primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Siguiente
            </button>
          </div>
        ) : (
          <div className="dev-wizard-footer">
            <button
              type="button"
              className="dev-wizard-btn dev-wizard-btn--secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              Anterior
            </button>
            <span />
          </div>
        )}
      </section>
    </div>
  )
}

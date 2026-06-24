import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'
import {
  PAYLOAD_TEMPLATES,
  buildPayloadFromAttributes,
  withAttributeIds,
  type AttributeDraft,
} from '../lib/onboardingTemplates'
import {
  buildCurlExamples,
  buildIntegratorGuideMarkdown,
  buildMappingTable,
  type StackTarget,
} from '../lib/onboardingSnippets'
import {
  ExampleNotice,
  Field,
  RoleHelpTable,
  SnippetBlock,
  StepIntro,
  copyToClipboard,
  downloadTextFile,
  inputClass,
  roleBriefHint,
  textareaClass,
} from '../components/onboarding/OnboardingUi'
import {
  draftToIntegrationAttributes,
  slugFromOrgName,
  upsertDevSolicitud,
  type DevRequestUser,
} from '../services/devPortalApi'

const STEPS = ['Organización', 'Contacto', 'Usuarios consola', 'Integración', 'Revisión'] as const

const DEFAULT_USERS: DevRequestUser[] = [
  { username: 'admin', nombreCompleto: 'Administrador', rol: 'admin' },
  { username: 'integrador', nombreCompleto: 'Integrador API', rol: 'integrador' },
]

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

  const [selectedTemplateId, setSelectedTemplateId] = useState('agro')
  const [entityName, setEntityName] = useState('Lote')
  const [businessIdField, setBusinessIdField] = useState('codigo_trazabilidad')
  const [entityType, setEntityType] = useState('lote')
  const [schemaVersion, setSchemaVersion] = useState('v1')
  const [attributes, setAttributes] = useState<AttributeDraft[]>(() =>
    withAttributeIds(PAYLOAD_TEMPLATES[0].attributes),
  )
  const [payloadExampleText, setPayloadExampleText] = useState(() =>
    buildPayloadFromAttributes(withAttributeIds(PAYLOAD_TEMPLATES[0].attributes), 'v1'),
  )
  const [stack, setStack] = useState<StackTarget>('laravel')

  const progressPct = ((step + 1) / STEPS.length) * 100

  const applyTemplate = (templateId: string) => {
    const template = PAYLOAD_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    setSelectedTemplateId(template.id)
    setEntityType(template.entityType)
    setEntityName(template.entityName)
    setBusinessIdField(template.businessIdField)
    setSchemaVersion(template.schemaVersion)
    const next = withAttributeIds(template.attributes)
    setAttributes(next)
    setPayloadExampleText(buildPayloadFromAttributes(next, template.schemaVersion))
  }

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
    <div className="mx-auto max-w-5xl flex-1 px-4 py-8 sm:px-8">
      <div className="h-2 overflow-hidden rounded-full bg-[#e5eaf2]">
        <div className="h-full rounded-full bg-[#1a3a5c] transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#6b7280]">
        Paso {step + 1} de {STEPS.length}: {STEPS[step]}
      </p>

      <section className="mt-6 rounded-3xl border border-line/60 bg-white p-6 shadow-sm sm:p-8">
        {step === 0 ? (
          <div>
            <h2 className="text-xl font-bold">Tu organización</h2>
            <StepIntro
              title="Identificador único"
              lines={['El tenant_id será el nombre de tu canal Fabric privado.']}
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Nombre comercial" value={orgName} onChange={onOrgNameChange} />
              <Field
                label="tenant_id"
                value={tenantId}
                onChange={(v) => {
                  setTenantTouched(true)
                  setTenantId(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="text-xl font-bold">Contacto de la organización</h2>
            <StepIntro
              title="¿Para qué pide Nexum estos datos?"
              lines={[
                'El operador Nexum los usa para contactarte y contextualizar tu solicitud al aprovisionar el tenant.',
                'No configuran la blockchain todavía: son datos operativos de tu proyecto.',
              ]}
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field
                label="Dominio web"
                value={domain}
                onChange={setDomain}
                placeholder="https://agro.tuempresa.com"
                help="URL base de tu sistema cliente. Referencia para webhooks, CORS y documentación. No es el tenant_id de Fabric."
              />
              <Field
                label="Email de contacto"
                value={contactEmail}
                onChange={setContactEmail}
                placeholder="integracion@tuempresa.com"
                help="Canal para notificaciones de la solicitud y entrega de credenciales. Si iniciaste sesión, al enviar se usará tu email de cuenta."
              />
            </div>
            {devEstado === 'autenticado' && usuario?.email ? (
              <p className="mt-3 mb-0 text-xs text-muted">
                Sesión activa: al enviar la solicitud se usará <strong>{usuario.email}</strong> como contacto principal.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="text-xl font-bold">Usuarios de la Consola Cliente</h2>
            <StepIntro
              title="¿Qué estás definiendo aquí?"
              lines={[
                'Cuentas de acceso a la Consola Cliente Nexum (no usuarios de tu app Laravel u otro backend).',
                'El operador las crea cuando aprueba tu solicitud y te entrega contraseñas o API keys según el rol.',
              ]}
            />
            <RoleHelpTable />
            <div className="mt-4 hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-4">
              <span>Usuario</span>
              <span>Nombre completo</span>
              <span className="sm:col-span-1">Rol en consola</span>
              <span>Acción</span>
            </div>
            <div className="mt-2 space-y-3">
              {users.map((u, idx) => (
                <div key={idx} className="rounded-xl border border-line/60 p-4">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-[10px] font-medium uppercase text-muted sm:hidden">Usuario</span>
                      <input
                        className={inputClass}
                        value={u.username}
                        placeholder="admin"
                        onChange={(e) => updateUser(idx, { username: e.target.value })}
                      />
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-[10px] font-medium uppercase text-muted sm:hidden">Nombre completo</span>
                      <input
                        className={inputClass}
                        value={u.nombreCompleto}
                        placeholder="Nombre visible"
                        onChange={(e) => updateUser(idx, { nombreCompleto: e.target.value })}
                      />
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-[10px] font-medium uppercase text-muted sm:hidden">Rol en consola</span>
                      <select
                        className={inputClass}
                        value={u.rol}
                        onChange={(e) => updateUser(idx, { rol: e.target.value as DevRequestUser['rol'] })}
                      >
                        <option value="admin">admin</option>
                        <option value="integrador">integrador</option>
                        <option value="lectura">lectura</option>
                      </select>
                    </label>
                    <div className="flex items-start sm:col-span-1">
                      <button type="button" className="text-xs text-red-600" onClick={() => removeUser(idx)}>
                        Quitar
                      </button>
                    </div>
                  </div>
                  <p className="mb-0 mt-2 text-[11px] text-muted">{roleBriefHint(u.rol)}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 rounded-full bg-[#1a3a5c] px-4 py-2 text-xs font-semibold text-white"
              onClick={addUser}
            >
              + Usuario
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="text-xl font-bold">Tu entidad en blockchain</h2>
            <StepIntro
              title="¿Cómo se traduce tu modelo al BaaS?"
              lines={[
                'Un campo único y estable de tu base de datos será datoId (clave en Fabric).',
                'tipo es una etiqueta libre del activo (lote, factura, paciente…).',
                'payload es el snapshot JSON que quieres volver inmutable en la cadena.',
              ]}
            />
            <ExampleNotice text="Las plantillas son punto de partida. Ajústalas a los campos reales de tu sistema." />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="form-label">
                <span className="d-flex align-items-center gap-2">
                  <span>Plantilla de ejemplo</span>
                </span>
                <select className={inputClass} value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)}>
                  {PAYLOAD_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="form-hint">Opcional: precarga campos típicos de un dominio (agro, salud…).</span>
              </label>
              <Field
                label="Nombre de tu entidad"
                value={entityName}
                onChange={setEntityName}
                placeholder="Lote"
                help="Modelo de tu ORM o tabla principal (Lote, Factura, Paciente…)."
              />
              <Field
                label="Campo ID de negocio → datoId"
                value={businessIdField}
                onChange={setBusinessIdField}
                placeholder="codigo_trazabilidad"
                help="Debe ser único y estable en tu BD. Nexum lo usará como clave del registro en blockchain."
              />
              <Field
                label="tipo (etiqueta BaaS)"
                value={entityType}
                onChange={setEntityType}
                placeholder="lote"
                help="Etiqueta libre que agrupa el activo en consultas y auditoría."
              />
              <Field
                label="schemaVersion"
                value={schemaVersion}
                onChange={setSchemaVersion}
                placeholder="v1"
                help="Versión del esquema de payload que enviarás en cada transacción."
              />
            </div>
            <SnippetBlock title="Vista previa del mapeo" value={mappingTable} onCopy={() => copyToClipboard(mappingTable)} />
            <label className="form-label mt-4">
              <span>Ejemplo de payload JSON</span>
              <textarea
                className={`${textareaClass} mt-1 min-h-32 font-mono text-xs`}
                value={payloadExampleText}
                onChange={(e) => setPayloadExampleText(e.target.value)}
                rows={8}
              />
              <span className="form-hint">
                Snapshot de ejemplo que tu backend enviaría en POST/PUT /datos. Puedes editarlo libremente.
              </span>
            </label>
            <label className="form-label mt-4">
              <span>Stack de tu backend (referencia)</span>
              <select className={inputClass} value={stack} onChange={(e) => setStack(e.target.value as StackTarget)}>
                <option value="laravel">Laravel / PHP</option>
                <option value="nodejs">Node.js</option>
                <option value="curl">cURL (solo pruebas manuales)</option>
              </select>
              <span className="form-hint">
                Indica en qué tecnología integrarás el middleware. El operador lo usa al preparar tu paquete de integración.
                Las API keys se entregan después del aprovisionamiento, no en este paso.
              </span>
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <h2 className="text-xl font-bold">Revisión y envío</h2>
            <StepIntro
              title="Antes de enviar"
              lines={[
                'Tras enviar, el operador Nexum revisará tu solicitud.',
                'Cuando la apruebe, recibirás credenciales y acceso al tenant en la Consola Cliente.',
              ]}
            />
            <div className="mt-4 overflow-hidden rounded-xl border border-line/60">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-line/40">
                  <tr>
                    <th className="w-36 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-muted">Organización</th>
                    <td className="px-4 py-3">
                      <p className="mb-0 font-medium text-ink">{orgName.trim() || '—'}</p>
                      <p className="mb-0 font-mono text-xs text-muted">tenant_id: {tenantId.trim() || '—'}</p>
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-muted">Contacto</th>
                    <td className="px-4 py-3">
                      <p className="mb-1">
                        <span className="text-muted">Dominio:</span> {domain.trim() || '—'}
                      </p>
                      <p className="mb-0">
                        <span className="text-muted">Email:</span> {emailEnvio || '—'}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-muted align-top">Usuarios</th>
                    <td className="px-4 py-3">
                      {usuariosFiltrados.length === 0 ? (
                        <span className="text-muted">Ninguno definido</span>
                      ) : (
                        <ul className="mb-0 list-unstyled space-y-1">
                          {usuariosFiltrados.map((u) => (
                            <li key={u.username} className="font-mono text-xs">
                              {u.username} · {u.rol}
                              {u.nombreCompleto ? (
                                <span className="font-sans text-muted"> ({u.nombreCompleto})</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-muted align-top">Integración</th>
                    <td className="px-4 py-3 text-sm">
                      <p className="mb-1">
                        Entidad <strong>{entityName}</strong> → datoId desde campo{' '}
                        <code className="text-xs">{businessIdField}</code>
                      </p>
                      <p className="mb-1">
                        tipo: <code className="text-xs">{entityType}</code> · schema:{' '}
                        <code className="text-xs">{schemaVersion}</code>
                      </p>
                      <p className="mb-0 text-muted">Stack: {stackLabel}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {devEstado !== 'autenticado' ? (
              <p className="mt-4 mb-0 text-sm text-amber-800">
                <Link to="/dev/login" className="font-semibold underline">
                  Inicia sesión
                </Link>{' '}
                para enviar la solicitud.
              </p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-[#f0b429] px-5 py-2.5 text-sm font-bold"
                disabled={saving || devEstado !== 'autenticado'}
                onClick={submit}
              >
                {saving ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              <button
                type="button"
                className="text-sm text-[#1a3a5c] underline"
                onClick={() => downloadTextFile(`integracion-${tenantId || 'tenant'}.md`, guideMd)}
              >
                Descargar borrador de integración (.md)
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex justify-between border-t border-line/40 pt-6">
          <button type="button" className="rounded-full border px-4 py-2 text-sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Anterior</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="rounded-full bg-[#1a3a5c] px-5 py-2 text-sm text-white" onClick={() => setStep((s) => s + 1)}>Siguiente</button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

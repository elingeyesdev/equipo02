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
  SnippetBlock,
  StepIntro,
  copyToClipboard,
  downloadTextFile,
  inputClass,
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
      navigate('/dev/login', { state: { from: '/dev' } })
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
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Dominio web" value={domain} onChange={setDomain} />
            <Field label="Email contacto" value={contactEmail} onChange={setContactEmail} />
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="space-y-3">
              {users.map((u, idx) => (
                <div key={idx} className="grid gap-2 rounded-xl border border-line/60 p-4 sm:grid-cols-4">
                  <input className={inputClass} value={u.username} onChange={(e) => updateUser(idx, { username: e.target.value })} />
                  <input className={inputClass} value={u.nombreCompleto} onChange={(e) => updateUser(idx, { nombreCompleto: e.target.value })} />
                  <select className={inputClass} value={u.rol} onChange={(e) => updateUser(idx, { rol: e.target.value as DevRequestUser['rol'] })}>
                    <option value="admin">admin</option>
                    <option value="integrador">integrador</option>
                    <option value="lectura">lectura</option>
                  </select>
                  <button type="button" className="text-xs text-red-600" onClick={() => removeUser(idx)}>Quitar</button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 rounded-full bg-[#1a3a5c] px-4 py-2 text-xs font-semibold text-white" onClick={addUser}>+ Usuario</button>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <ExampleNotice text="Plantillas de /onboarding." />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-medium text-[#6b7280]">
                Plantilla
                <select className={`${inputClass} mt-1.5`} value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)}>
                  {PAYLOAD_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              <Field label="Entidad" value={entityName} onChange={setEntityName} />
              <Field label="Campo → datoId" value={businessIdField} onChange={setBusinessIdField} />
              <Field label="tipo" value={entityType} onChange={setEntityType} />
            </div>
            <SnippetBlock title="Mapeo" value={mappingTable} onCopy={() => copyToClipboard(mappingTable)} />
            <textarea className={`${textareaClass} mt-4 min-h-32 font-mono text-xs`} value={payloadExampleText} onChange={(e) => setPayloadExampleText(e.target.value)} />
            <select className={`${inputClass} mt-4`} value={stack} onChange={(e) => setStack(e.target.value as StackTarget)}>
              <option value="laravel">Laravel</option>
              <option value="nodejs">Node.js</option>
              <option value="curl">cURL</option>
            </select>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            {devEstado !== 'autenticado' ? (
              <p className="mb-3 text-sm text-amber-800">
                <Link to="/dev/login" className="font-semibold underline">Inicia sesión</Link>
                {' '}para enviar la solicitud.
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="button" className="rounded-full bg-[#f0b429] px-5 py-2.5 text-sm font-bold" disabled={saving} onClick={submit}>
              {saving ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button type="button" className="ml-3 text-sm" onClick={() => downloadTextFile(`integracion-${tenantId}.md`, guideMd)}>Descargar .md</button>
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

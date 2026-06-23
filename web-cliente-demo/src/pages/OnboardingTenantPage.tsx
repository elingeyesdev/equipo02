import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ATTRIBUTE_TYPE_LABELS,
  PAYLOAD_TEMPLATES,
  buildPayloadFromAttributes,
  withAttributeIds,
  type AttributeDraft,
  type AttributeType,
} from '../lib/onboardingTemplates'
import IntegrationCodePanel from '../components/codegen/IntegrationCodePanel'
import {
  buildCurlExamples,
  buildEnvSnippet,
  buildIntegratorGuideMarkdown,
  buildMappingTable,
  integrationManualPath,
  type ApiKeyRole,
  type StackTarget,
} from '../lib/onboardingSnippets'
import {
  Checklist,
  ExampleNotice,
  Field,
  RoleAlert,
  SnippetBlock,
  StepIntro,
  copyToClipboard,
  downloadTextFile,
  inputClass,
  textareaClass,
} from '../components/onboarding/OnboardingUi'

const INTEGRATOR_STEPS = [
  { id: 'credentials', title: 'Qué necesitas', subtitle: 'URL, API key y rol' },
  { id: 'mapping', title: 'Mapea tu entidad', subtitle: 'datoId, tipo y payload' },
  { id: 'code', title: 'Código en tu backend', subtitle: 'Laravel o Node.js' },
  { id: 'test', title: 'Probar conexión', subtitle: 'cURL y checklist' },
]

export default function OnboardingTenantPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [targetStack, setTargetStack] = useState<StackTarget>('laravel')

  const [baseUrl, setBaseUrl] = useState('http://localhost:3000')
  const [apiKey, setApiKey] = useState('agri-int-2026')
  const [apiKeyRole, setApiKeyRole] = useState<ApiKeyRole>('integrador')
  const [repoUrl, setRepoUrl] = useState('https://github.com/tu-org/proyecto-blockchain')

  const [entityName, setEntityName] = useState('Lote')
  const [businessIdField, setBusinessIdField] = useState('codigo_trazabilidad')
  const [selectedTemplateId, setSelectedTemplateId] = useState('agro')
  const [entityType, setEntityType] = useState('lote')
  const [schemaVersion, setSchemaVersion] = useState('v1')
  const [attributes, setAttributes] = useState<AttributeDraft[]>(() =>
    withAttributeIds(PAYLOAD_TEMPLATES[0].attributes),
  )
  const [payloadExampleText, setPayloadExampleText] = useState(() =>
    buildPayloadFromAttributes(withAttributeIds(PAYLOAD_TEMPLATES[0].attributes), 'v1'),
  )

  const progressPct = ((activeStep + 1) / INTEGRATOR_STEPS.length) * 100
  const manualUrl = integrationManualPath(repoUrl)

  const ctx = useMemo(
    () => ({
      baseUrl,
      apiKey,
      apiKeyRole,
      entityName,
      businessIdField,
      entityType,
      schemaVersion,
      payloadExampleText,
      attributes: attributes.map((a) => ({
        key: a.name,
        label: a.name,
        type: a.type,
        required: false,
      })),
    }),
    [baseUrl, apiKey, apiKeyRole, entityName, businessIdField, entityType, schemaVersion, payloadExampleText, attributes],
  )

  const envSnippet = useMemo(() => buildEnvSnippet(ctx), [ctx])
  const mappingTable = useMemo(() => buildMappingTable(ctx), [ctx])
  const curlExamples = useMemo(() => buildCurlExamples(ctx), [ctx])
  const integratorGuide = useMemo(() => buildIntegratorGuideMarkdown(ctx, curlExamples, repoUrl), [ctx, curlExamples, repoUrl])

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

  const syncPayload = (nextAttributes: AttributeDraft[], ver: string) => {
    setPayloadExampleText(buildPayloadFromAttributes(nextAttributes, ver))
  }

  const addAttribute = () => {
    const next = [...attributes, { id: crypto.randomUUID(), name: '', type: 'texto' as AttributeType, example: '' }]
    setAttributes(next)
    syncPayload(next, schemaVersion)
  }

  const removeAttribute = (id: string) => {
    const next = attributes.filter((a) => a.id !== id)
    setAttributes(next)
    syncPayload(next, schemaVersion)
  }

  const updateAttribute = (id: string, patch: Partial<AttributeDraft>) => {
    const next = attributes.map((a) => (a.id === id ? { ...a, ...patch } : a))
    setAttributes(next)
    syncPayload(next, schemaVersion)
  }

  const next = () => setActiveStep((s) => Math.min(s + 1, INTEGRATOR_STEPS.length - 1))
  const prev = () => setActiveStep((s) => Math.max(s - 1, 0))

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="text-sm font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">
            Nexum
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/onboarding/operador" className="font-medium text-[#6b7280] hover:text-[#1a3a5c]">
              Soy operador del BaaS
            </Link>
            <Link to="/login" className="font-medium text-[#6b7280] hover:text-[#1a3a5c]">
              Ir al panel
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <p className="text-sm font-medium text-[#c48f12]">Integración externa</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-[#1a2332] sm:text-3xl">
              Conecta tu sistema al BaaS en 4 pasos
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-snug text-[#6b7280]">
              Tu backend envía datos al middleware con HTTP. <strong>No necesitas exponer endpoints nuevos</strong> ni
              conocer Hyperledger Fabric.
            </p>
          </div>
          <div className="flex flex-col rounded-2xl border border-[#1a3a5c]/15 bg-[#1a3a5c] px-5 py-3 text-white shadow-sm">
            <p className="text-sm font-semibold">Manual técnico completo</p>
            <p className="mt-1 text-xs text-white/75">Contrato REST, errores y casos de prueba.</p>
            <a
              className="mt-2.5 inline-flex w-full items-center justify-center rounded-full bg-[#f0b429] px-4 py-2 text-xs font-bold text-[#1a2332] hover:bg-[#f5c24a]"
              href={manualUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver manual de integración
            </a>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <section className="min-w-0 rounded-3xl border border-line/60 bg-white p-6 shadow-sm sm:p-8">
            {activeStep === 0 ? (
              <div>
                <h2 className="text-xl font-bold text-[#1a2332]">Paso 1 · Qué necesitas del BaaS</h2>
                <StepIntro
                  title="¿Debo modificar mi sistema?"
                  lines={[
                    'Sí: agrega código en tu BACKEND (servidor), no en el frontend.',
                    'Después de guardar en tu base de datos, tu servidor hace POST o PUT al BaaS.',
                    'El operador del BaaS te entrega URL + API key. Tú las pones en variables de entorno.',
                  ]}
                />
                <div className="mt-5 overflow-hidden rounded-2xl border border-line/60">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f4f7fb] text-xs uppercase text-[#6b7280]">
                      <tr>
                        <th className="px-4 py-3">Entregable</th>
                        <th className="px-4 py-3">Dónde va en TU sistema</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40">
                      <tr>
                        <td className="px-4 py-3">URL middleware</td>
                        <td className="px-4 py-3 font-mono text-xs">.env → BLOCKCHAIN_API_URL</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">API key</td>
                        <td className="px-4 py-3 font-mono text-xs">.env → BLOCKCHAIN_API_KEY (solo servidor)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">Rol de la key</td>
                        <td className="px-4 py-3">Define si escribes directo (admin) o vas a cola (integrador)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field label="URL del BaaS" value={baseUrl} onChange={setBaseUrl} placeholder="http://localhost:3000" help="La entrega el operador del BaaS." />
                  <Field label="API key" value={apiKey} onChange={setApiKey} placeholder="agri-int-2026" help="Nunca en VITE_* ni en el navegador." />
                  <label className="block text-xs font-medium text-[#6b7280] md:col-span-2">
                    Rol de esta API key
                    <select className={`${inputClass} mt-1.5`} value={apiKeyRole} onChange={(e) => setApiKeyRole(e.target.value as ApiKeyRole)}>
                      <option value="integrador">integrador (cola de aprobación → 202)</option>
                      <option value="admin">admin (escritura directa → 201)</option>
                      <option value="lectura">lectura (solo GET)</option>
                    </select>
                  </label>
                </div>
                <RoleAlert role={apiKeyRole} />
                <SnippetBlock title=".env de tu servidor" value={envSnippet} onCopy={() => copyToClipboard(envSnippet)} />
              </div>
            ) : null}

            {activeStep === 1 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 2 · Mapea tu entidad al BaaS</h2>
                <StepIntro
                  title="¿Cómo se traduce mi modelo?"
                  lines={[
                    'Un campo único de tu BD será datoId (clave en blockchain).',
                    'tipo es una etiqueta libre (lote, consulta, factura…).',
                    'payload es un JSON con el snapshot que quieres volver inmutable.',
                  ]}
                />
                <ExampleNotice text="Las plantillas son puntos de partida. Cámbialas por los campos reales de tu sistema." />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="block text-xs font-medium text-[#6b7280]">
                    Plantilla de ejemplo
                    <select className={`${inputClass} mt-1.5`} value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)}>
                      {PAYLOAD_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field label="Nombre de tu entidad" value={entityName} onChange={setEntityName} placeholder="Lote" help="Modelo de tu ORM (Lote, Factura, Paciente…)" />
                  <Field label="Campo ID de negocio → datoId" value={businessIdField} onChange={setBusinessIdField} placeholder="codigo_trazabilidad" help="Debe ser único y estable." />
                  <Field label="tipo (etiqueta BaaS)" value={entityType} onChange={setEntityType} placeholder="lote" />
                  <Field label="schemaVersion" value={schemaVersion} onChange={(v) => { setSchemaVersion(v); syncPayload(attributes, v) }} placeholder="v1" />
                </div>
                <SnippetBlock title="Vista previa del mapeo" value={mappingTable} onCopy={() => copyToClipboard(mappingTable)} />
                <div className="mt-6 rounded-2xl border border-line/60 bg-[#fafbfd]">
                  <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
                    <p className="text-sm font-semibold">Atributos del payload</p>
                    <button type="button" className="rounded-full bg-[#1a3a5c] px-4 py-1.5 text-xs font-semibold text-white" onClick={addAttribute}>
                      + Atributo
                    </button>
                  </div>
                  <div className="space-y-4 p-5">
                    {attributes.map((attr) => (
                      <div key={attr.id} className="rounded-xl border border-line/60 bg-white p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input className={inputClass} value={attr.name} placeholder="nombre_campo" onChange={(e) => updateAttribute(attr.id, { name: e.target.value })} />
                          <select className={inputClass} value={attr.type} onChange={(e) => updateAttribute(attr.id, { type: e.target.value as AttributeType })}>
                            {(Object.keys(ATTRIBUTE_TYPE_LABELS) as AttributeType[]).map((t) => (
                              <option key={t} value={t}>
                                {ATTRIBUTE_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input className={`${inputClass} mt-3`} value={attr.example} placeholder="valor ejemplo" onChange={(e) => updateAttribute(attr.id, { example: e.target.value })} />
                        <button type="button" className="mt-2 text-xs text-red-600" onClick={() => removeAttribute(attr.id)}>
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <label className="mt-4 block text-xs font-medium text-muted">
                  Payload JSON generado
                  <textarea className={`${textareaClass} mt-1 min-h-48 font-mono text-xs`} value={payloadExampleText} onChange={(e) => setPayloadExampleText(e.target.value)} rows={10} />
                </label>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 3 · Código en tu backend</h2>
                <StepIntro
                  title="¿Dónde pongo esto?"
                  lines={[
                    'En tu Controller o Service, DESPUÉS de que la BD local guarde con éxito.',
                    'Carpeta sugerida Laravel: app/Services/Blockchain/',
                    'NUNCA en React, Vite ni variables VITE_* — la API key queda expuesta.',
                  ]}
                />
                <RoleAlert role={apiKeyRole} />
                <div className="mt-3 btn-group flex-wrap" role="group">
                  {(['laravel', 'nodejs', 'curl'] as StackTarget[]).map((stack) => (
                    <button
                      key={stack}
                      type="button"
                      onClick={() => setTargetStack(stack)}
                      className={`btn btn-sm ${targetStack === stack ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                      {stack === 'laravel' ? 'Laravel / PHP' : stack === 'nodejs' ? 'Node.js' : 'Solo cURL'}
                    </button>
                  ))}
                </div>
                <IntegrationCodePanel
                  ctx={ctx}
                  stack={targetStack}
                  repoUrl={repoUrl}
                  downloadName={`integracion-baas-${entityType || 'sistema'}`}
                />
                <Checklist
                  items={[
                    'Variables BLOCKCHAIN_* solo en el servidor',
                    `datoId = ${businessIdField || 'tu_campo_id'}`,
                    'POST en alta, PUT en edición (payload completo)',
                    apiKeyRole === 'integrador' ? 'Manejar HTTP 202 como pendiente, no como error' : 'Esperar HTTP 201 con txId',
                    'Opcional: guardar txId o solicitudId en tu BD local',
                  ]}
                />
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 4 · Probar conexión</h2>
                <StepIntro
                  title="Orden recomendado"
                  lines={[
                    '1) Ejecuta el cURL de alta en tu terminal.',
                    '2) Verifica 201 (admin) o 202 (integrador).',
                    '3) Consulta el historial con GET.',
                    '4) Si responde OK, copia el código del paso 3 a tu backend.',
                  ]}
                />
                <Field label="URL repo (para la guía descargable)" value={repoUrl} onChange={setRepoUrl} />
                <IntegrationCodePanel ctx={ctx} stack={targetStack} showTestButton repoUrl={repoUrl} />
                <Checklist
                  items={[
                    'BLOCKCHAIN_* configurado en .env del servidor',
                    `Campo ${businessIdField || 'id'} mapeado a datoId`,
                    'cURL de alta respondió 201 o 202',
                    'GET historial devuelve al menos una entrada',
                    'Código del paso 3 integrado tras guardar en BD',
                    'API key no visible en DevTools del navegador',
                  ]}
                />
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-[#1a3a5c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2844]"
                    onClick={() => downloadTextFile(`integracion-baas-${entityType || 'sistema'}.md`, integratorGuide)}
                  >
                    Descargar paquete de integración (.md)
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-[#374151]"
                    onClick={() => copyToClipboard(integratorGuide)}
                  >
                    Copiar paquete completo
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-line/60 pt-6">
              <button type="button" onClick={prev} disabled={activeStep === 0} className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
                Anterior
              </button>
              <button type="button" onClick={next} disabled={activeStep === INTEGRATOR_STEPS.length - 1} className="rounded-full bg-[#1a3a5c] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </section>

          <aside className="lg:sticky lg:top-8">
            <div className="rounded-3xl border border-line/60 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Progreso</p>
              <p className="mt-1 text-lg font-bold text-[#1a2332]">{INTEGRATOR_STEPS[activeStep].title}</p>
              <div className="mt-4 h-1.5 rounded-full bg-[#e8edf3]">
                <div className="h-full rounded-full bg-[#f0b429] transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <ol className="mt-6 space-y-1">
                {INTEGRATOR_STEPS.map((step, idx) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => setActiveStep(idx)}
                      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left ${idx === activeStep ? 'bg-[#1a3a5c]/8 ring-1 ring-[#1a3a5c]/15' : 'hover:bg-[#f4f7fb]'}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${idx < activeStep ? 'bg-emerald-500 text-white' : idx === activeStep ? 'bg-[#1a3a5c] text-white' : 'bg-[#e8edf3] text-[#6b7280]'}`}>
                        {idx < activeStep ? '✓' : idx + 1}
                      </span>
                      <span>
                        <span className={`block text-sm font-semibold ${idx === activeStep ? 'text-[#1a3a5c]' : 'text-[#374151]'}`}>{step.title}</span>
                        <span className="mt-0.5 block text-[11px] text-[#9ca3af]">{step.subtitle}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

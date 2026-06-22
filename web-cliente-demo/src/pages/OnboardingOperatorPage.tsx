import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Checklist,
  Field,
  SnippetBlock,
  StepIntro,
  copyToClipboard,
  downloadTextFile,
  inputClass,
  randomKey,
} from '../components/onboarding/OnboardingUi'

type UserRole = 'admin' | 'integrador' | 'lectura'

type UserDraft = {
  id: string
  username: string
  fullName: string
  role: UserRole
  passwordHint: string
}

/** Onboarding para operadores del BaaS (Fabric, tenants.yaml, usuarios consola). */
export default function OnboardingOperatorPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [fabricMode, setFabricMode] = useState<'basic' | 'advanced'>('basic')

  const [tenantName, setTenantName] = useState('Cliente Externo')
  const [tenantId, setTenantId] = useState('cliente-externo')
  const [description, setDescription] = useState('Integración externa sobre dato_cc (JSON libre).')
  const [channel, setChannel] = useState('canal-cliente')
  const [chaincode, setChaincode] = useState('dato_cc')
  const [mspId, setMspId] = useState('Org1MSP')
  const [peerEndpoint, setPeerEndpoint] = useState('localhost:7051')
  const [peerHostAlias, setPeerHostAlias] = useState('peer0.org1.example.com')
  const [certPath, setCertPath] = useState(
    './red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem',
  )
  const [keyPathDir, setKeyPathDir] = useState(
    './red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore',
  )
  const [tlsCertPath, setTlsCertPath] = useState(
    './red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt',
  )

  const [apiKeyAdmin, setApiKeyAdmin] = useState(randomKey('admin'))
  const [apiKeyIntegrador, setApiKeyIntegrador] = useState(randomKey('int'))
  const [apiKeyLectura, setApiKeyLectura] = useState(randomKey('lect'))
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000')

  const [users, setUsers] = useState<UserDraft[]>([
    {
      id: crypto.randomUUID(),
      username: 'admin_cliente',
      fullName: 'Admin Cliente',
      role: 'admin',
      passwordHint: 'admin-cliente-2026',
    },
    {
      id: crypto.randomUUID(),
      username: 'integrador_cliente',
      fullName: 'Integrador Cliente',
      role: 'integrador',
      passwordHint: 'integrador-cliente-2026',
    },
  ])

  const steps = useMemo(
    () => [
      { id: 'tenant', title: 'Configurar tenant', subtitle: 'MSP, canal, chaincode' },
      { id: 'keys', title: 'API keys', subtitle: 'Claves por rol' },
      { id: 'users', title: 'Usuarios consola', subtitle: 'web-cliente-demo' },
      { id: 'deliver', title: 'Entregar al integrador', subtitle: 'Snippets y checklist' },
    ],
    [],
  )

  const progressPct = ((activeStep + 1) / steps.length) * 100

  const tenantsYamlSnippet = useMemo(
    () => `  ${tenantId}:
    nombre: "${tenantName}"
    descripcion: "${description}"
    msp_id: "${mspId}"
    cert_path: "${certPath}"
    key_path_dir: "${keyPathDir}"
    tls_cert_path: "${tlsCertPath}"
    peer_endpoint: "${peerEndpoint}"
    peer_host_alias: "${peerHostAlias}"
    canal: "${channel}"
    chaincode: "${chaincode}"
    api_keys:
      "${apiKeyAdmin}": admin
      "${apiKeyIntegrador}": integrador
      "${apiKeyLectura}": solo_lectura`,
    [
      tenantId,
      tenantName,
      description,
      mspId,
      certPath,
      keyPathDir,
      tlsCertPath,
      peerEndpoint,
      peerHostAlias,
      channel,
      chaincode,
      apiKeyAdmin,
      apiKeyIntegrador,
      apiKeyLectura,
    ],
  )

  const usuariosAdminYamlSnippet = useMemo(() => {
    const usersYaml = users
      .map(
        (u) => `  - usuario: ${u.username}
    nombre_completo: "${u.fullName}"
    rol: ${u.role}
    tenant: ${tenantId}
    contrasena_hash: "REEMPLAZAR_CON_BCRYPT"`,
      )
      .join('\n\n')

    return `  ${tenantId}:
    nombre: "${tenantName}"
    api_keys:
      admin: ${apiKeyAdmin}
      integrador: ${apiKeyIntegrador}
      lectura: ${apiKeyLectura}

${usersYaml}`
  }, [users, tenantId, tenantName, apiKeyAdmin, apiKeyIntegrador, apiKeyLectura])

  const integratorHandoff = useMemo(
    () => `# Credenciales para el equipo integrador — ${tenantName}

Entrega estos datos al desarrollador del sistema externo:

| Dato | Valor |
|------|-------|
| URL BaaS | ${baseUrl.replace(/\/+$/, '')} |
| API key integrador | ${apiKeyIntegrador} |
| API key lectura (consultas) | ${apiKeyLectura} |
| API key admin (solo operaciones internas) | ${apiKeyAdmin} |

El integrador debe usar el onboarding público:
/onboarding

Documentación: docs/manual-integracion-baas-v2.md#integrador-externo
`,
    [tenantName, baseUrl, apiKeyIntegrador, apiKeyLectura, apiKeyAdmin],
  )

  const addUser = () => {
    setUsers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), username: '', fullName: '', role: 'lectura', passwordHint: '' },
    ])
  }

  const removeUser = (id: string) => setUsers((prev) => prev.filter((u) => u.id !== id))

  const updateUser = (id: string, patch: Partial<UserDraft>) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

  const applyLocalFabricDefaults = () => {
    setMspId('Org1MSP')
    setPeerEndpoint('localhost:7051')
    setPeerHostAlias('peer0.org1.example.com')
  }

  const next = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1))
  const prev = () => setActiveStep((s) => Math.max(s - 1, 0))

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="text-sm font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">
            Nexum
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/onboarding" className="font-medium text-[#6b7280] hover:text-[#1a3a5c]">
              Soy integrador externo
            </Link>
            <Link to="/login" className="font-medium text-[#6b7280] hover:text-[#1a3a5c]">
              Ir al panel
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
        <p className="text-sm font-medium text-[#c48f12]">Operador del BaaS</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1a2332] sm:text-3xl">Alta de tenant y entrega al integrador</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#6b7280]">
          Configura Fabric, API keys y usuarios de consola. Al final, entrega las credenciales al equipo que
          conectará su sistema.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_260px]">
          <section className="rounded-3xl border border-line/60 bg-white p-6 shadow-sm sm:p-8">
            {activeStep === 0 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 1 · Tenant en Fabric</h2>
                <StepIntro
                  title="¿Qué configuras aquí?"
                  lines={[
                    'Canal y chaincode dato_cc aislados para este cliente.',
                    'El snippet resultante va en api-middleware/config/tenants.yaml.',
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFabricMode('basic')}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${fabricMode === 'basic' ? 'border-accent bg-accent/10' : 'border-line'}`}
                  >
                    Modo básico
                  </button>
                  <button
                    type="button"
                    onClick={() => setFabricMode('advanced')}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${fabricMode === 'advanced' ? 'border-accent bg-accent/10' : 'border-line'}`}
                  >
                    Modo avanzado
                  </button>
                  <button type="button" onClick={applyLocalFabricDefaults} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold">
                    Valores locales demo
                  </button>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field label="ID tenant" value={tenantId} onChange={setTenantId} placeholder="agricultura" />
                  <Field label="Nombre" value={tenantName} onChange={setTenantName} />
                  <Field label="Descripción" value={description} onChange={setDescription} />
                  <Field label="Canal Fabric" value={channel} onChange={setChannel} />
                  <Field label="Chaincode" value={chaincode} onChange={setChaincode} />
                  {fabricMode === 'advanced' ? (
                    <>
                      <Field label="MSP ID" value={mspId} onChange={setMspId} />
                      <Field label="Peer endpoint" value={peerEndpoint} onChange={setPeerEndpoint} />
                      <Field label="cert_path" value={certPath} onChange={setCertPath} />
                      <Field label="key_path_dir" value={keyPathDir} onChange={setKeyPathDir} />
                      <Field label="tls_cert_path" value={tlsCertPath} onChange={setTlsCertPath} />
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeStep === 1 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 2 · API keys</h2>
                <StepIntro
                  title="¿Para qué sirven?"
                  lines={[
                    'Integrador: la usará el backend del sistema externo (POST/PUT → cola o directo).',
                    'Lectura: consultas e historial.',
                    'Admin: operaciones directas y aprobaciones en consola.',
                  ]}
                />
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Field label="Key admin" value={apiKeyAdmin} onChange={setApiKeyAdmin} />
                  <Field label="Key integrador" value={apiKeyIntegrador} onChange={setApiKeyIntegrador} />
                  <Field label="Key lectura" value={apiKeyLectura} onChange={setApiKeyLectura} />
                </div>
                <button type="button" className="mt-4 text-xs font-semibold text-[#1a3a5c] underline" onClick={() => {
                  setApiKeyAdmin(randomKey('admin'))
                  setApiKeyIntegrador(randomKey('int'))
                  setApiKeyLectura(randomKey('lect'))
                }}>
                  Regenerar keys
                </button>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 3 · Usuarios consola</h2>
                <div className="mt-6 space-y-4">
                  {users.map((u) => (
                    <div key={u.id} className="rounded-xl border border-line/60 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Usuario" value={u.username} onChange={(v) => updateUser(u.id, { username: v })} />
                        <Field label="Nombre" value={u.fullName} onChange={(v) => updateUser(u.id, { fullName: v })} />
                        <Field label="Password hint" value={u.passwordHint} onChange={(v) => updateUser(u.id, { passwordHint: v })} />
                        <label className="text-xs font-medium text-muted">
                          Rol
                          <select className={`${inputClass} mt-1`} value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}>
                            <option value="admin">admin</option>
                            <option value="integrador">integrador</option>
                            <option value="lectura">lectura</option>
                          </select>
                        </label>
                      </div>
                      <button type="button" className="mt-2 text-xs text-red-600" onClick={() => removeUser(u.id)}>
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-4 text-xs font-semibold" onClick={addUser}>
                  + Agregar usuario
                </button>
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div>
                <h2 className="text-xl font-bold">Paso 4 · Entregar al integrador</h2>
                <Field label="URL middleware" value={baseUrl} onChange={setBaseUrl} />
                <SnippetBlock title="tenants.yaml" value={tenantsYamlSnippet} onCopy={() => copyToClipboard(tenantsYamlSnippet)} />
                <SnippetBlock title="usuarios-admin.yaml" value={usuariosAdminYamlSnippet} onCopy={() => copyToClipboard(usuariosAdminYamlSnippet)} />
                <SnippetBlock title="Hoja de entrega al integrador" value={integratorHandoff} onCopy={() => copyToClipboard(integratorHandoff)} />
                <Checklist
                  items={[
                    'Canal Fabric creado y dato_cc desplegado',
                    'tenant en tenants.yaml y middleware reiniciado',
                    'Usuarios consola con bcrypt en usuarios-admin.yaml',
                    'Credenciales entregadas al equipo externo',
                    'Integrador completó /onboarding con su mapeo de entidad',
                  ]}
                />
                <button
                  type="button"
                  className="mt-6 rounded-full bg-[#1a3a5c] px-5 py-2.5 text-sm font-semibold text-white"
                  onClick={() => downloadTextFile(`entrega-integrador-${tenantId}.md`, integratorHandoff)}
                >
                  Descargar hoja de entrega
                </button>
              </div>
            ) : null}

            <div className="mt-8 flex justify-between border-t border-line/60 pt-6">
              <button type="button" disabled={activeStep === 0} onClick={prev} className="rounded-full border px-5 py-2 text-sm font-semibold disabled:opacity-40">
                Anterior
              </button>
              <button type="button" disabled={activeStep === steps.length - 1} onClick={next} className="rounded-full bg-[#1a3a5c] px-6 py-2 text-sm font-semibold text-white disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </section>

          <aside className="rounded-3xl border border-line/60 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#9ca3af]">Progreso operador</p>
            <div className="mt-3 h-1.5 rounded-full bg-[#e8edf3]">
              <div className="h-full rounded-full bg-[#f0b429] transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <ol className="mt-4 space-y-2">
              {steps.map((s, idx) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setActiveStep(idx)} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${idx === activeStep ? 'bg-[#1a3a5c]/8 font-semibold text-[#1a3a5c]' : 'text-[#374151]'}`}>
                    {idx + 1}. {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  )
}

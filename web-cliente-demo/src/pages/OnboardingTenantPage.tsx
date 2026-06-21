import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type UserRole = 'admin' | 'integrador' | 'lectura'

type UserDraft = {
  id: string
  username: string
  fullName: string
  role: UserRole
  passwordHint: string
}

type AttributeType = 'texto' | 'numero' | 'booleano' | 'fecha' | 'lista'

type AttributeDraft = {
  id: string
  name: string
  type: AttributeType
  example: string
}

type PayloadTemplate = {
  id: string
  label: string
  entityType: string
  schemaVersion: string
  attributes: Array<Omit<AttributeDraft, 'id'>>
}

const inputClass =
  'w-full rounded-lg border border-line/80 bg-white px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/70 transition-shadow focus:border-[#1a3a5c]/40 focus:ring-2 focus:ring-[#1a3a5c]/10'

const textareaClass = `${inputClass} resize-y leading-relaxed`

function randomKey(prefix: string): string {
  const raw = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${raw}`
}

function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value)
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const PAYLOAD_TEMPLATES: PayloadTemplate[] = [
  {
    id: 'agro',
    label: 'Ejemplo: Agro (lotes)',
    entityType: 'lote_snapshot',
    schemaVersion: 'v1',
    attributes: [
      { name: 'codigo', type: 'texto', example: 'LOTE-001' },
      { name: 'nombre', type: 'texto', example: 'Lote Norte' },
      { name: 'estado', type: 'texto', example: 'en_produccion' },
      {
        name: 'actividades',
        type: 'lista',
        example: '[{"id":"ACT-1","nombre":"Riego","fecha":"2026-06-12"}]',
      },
      {
        name: 'producciones',
        type: 'lista',
        example: '[{"id":"PROD-1","tipo":"tomate","cantidad":120,"unidad":"kg"}]',
      },
      { name: 'updatedAt', type: 'fecha', example: '2026-06-12T00:00:00Z' },
    ],
  },
  {
    id: 'erp',
    label: 'Ejemplo: ERP generico',
    entityType: 'registro_erp',
    schemaVersion: 'v1',
    attributes: [
      { name: 'codigo', type: 'texto', example: 'ERP-0001' },
      { name: 'tipoOperacion', type: 'texto', example: 'venta' },
      { name: 'estado', type: 'texto', example: 'aprobado' },
      { name: 'monto', type: 'numero', example: '1500.75' },
      { name: 'moneda', type: 'texto', example: 'USD' },
      { name: 'updatedAt', type: 'fecha', example: '2026-06-12T00:00:00Z' },
    ],
  },
  {
    id: 'academico',
    label: 'Ejemplo: Academico',
    entityType: 'registro_academico',
    schemaVersion: 'v1',
    attributes: [
      { name: 'codigo', type: 'texto', example: 'MAT-001' },
      { name: 'estudianteId', type: 'texto', example: 'EST-100' },
      { name: 'materia', type: 'texto', example: 'Blockchain I' },
      { name: 'estado', type: 'texto', example: 'aprobado' },
      { name: 'notaFinal', type: 'numero', example: '18' },
      { name: 'updatedAt', type: 'fecha', example: '2026-06-12T00:00:00Z' },
    ],
  },
]

const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  texto: 'Texto',
  numero: 'Numero',
  booleano: 'Si / No',
  fecha: 'Fecha (ISO)',
  lista: 'Lista (JSON)',
}

function attributeExampleValue(attr: Pick<AttributeDraft, 'type' | 'example'>): unknown {
  const raw = attr.example.trim()
  switch (attr.type) {
    case 'numero': {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : 0
    }
    case 'booleano':
      return raw.toLowerCase() === 'true' || raw.toLowerCase() === 'si'
    case 'lista': {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return raw ? [raw] : []
      }
    }
    case 'fecha':
    case 'texto':
    default:
      return raw
  }
}

function buildPayloadFromAttributes(attributes: AttributeDraft[], schemaVersion: string): string {
  const payload: Record<string, unknown> = {
    schemaVersion: schemaVersion.trim() || 'v1',
  }
  for (const attr of attributes) {
    const name = attr.name.trim()
    if (!name) continue
    payload[name] = attributeExampleValue(attr)
  }
  return JSON.stringify(payload, null, 2)
}

function withIds(attributes: Array<Omit<AttributeDraft, 'id'>>): AttributeDraft[] {
  return attributes.map((attr) => ({ ...attr, id: crypto.randomUUID() }))
}

export default function OnboardingTenantPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [fabricMode, setFabricMode] = useState<'basic' | 'advanced'>('basic')
  // TODO: Reemplazar con la URL final del documento cuando esté listo.
  const integrationGuideUrl = ''

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
  const [repoUrl, setRepoUrl] = useState('https://github.com/tu-org/proyecto-blockchain')
  const [selectedTemplateId, setSelectedTemplateId] = useState('agro')
  const [schemaVersion, setSchemaVersion] = useState('v1')
  const [entityType, setEntityType] = useState('lote_snapshot')
  const [attributes, setAttributes] = useState<AttributeDraft[]>(() =>
    withIds(PAYLOAD_TEMPLATES[0].attributes),
  )
  const [payloadExampleText, setPayloadExampleText] = useState(() =>
    buildPayloadFromAttributes(withIds(PAYLOAD_TEMPLATES[0].attributes), 'v1'),
  )

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
      {
        id: 'tenant',
        title: 'Configurar tenant',
        subtitle: 'MSP, canal, chaincode y rutas de certificados',
      },
      {
        id: 'keys',
        title: 'Definir API keys',
        subtitle: 'Claves por rol para admin, integrador y lectura',
      },
      {
        id: 'users',
        title: 'Crear usuarios de consola',
        subtitle: 'Cuentas de acceso a web-cliente-demo',
      },
      {
        id: 'contract',
        title: 'Definir contrato de datos',
        subtitle: 'Payload versionado y campos obligatorios',
      },
      {
        id: 'validate',
        title: 'Probar integración',
        subtitle: 'cURL de alta, edición, historial y restauración',
      },
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
    # Generar bcrypt con:
    # go run ./cmd/bcrypt-gen "${u.passwordHint || 'cambiar-este-password'}"
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

  const effectiveSchemaVersion = schemaVersion.trim() || 'v1'

  const curlExamples = useMemo(() => {
    const base = baseUrl.replace(/\/+$/, '')
    let payloadForCurl = `{
      "schemaVersion": "${effectiveSchemaVersion}",
      "estado": "activo"
    }`
    try {
      const parsed = JSON.parse(payloadExampleText)
      payloadForCurl = JSON.stringify(parsed, null, 2)
        .split('\n')
        .map((line, idx) => (idx === 0 ? line : `    ${line}`))
        .join('\n')
    } catch {
      // si el JSON del paso 4 esta mal formado, el cURL usa un payload minimo
    }
    return {
      create: `# EJEMPLO ILUSTRATIVO: el payload viene del contrato definido en el paso 4.
# Reemplaza datoId y los valores por los datos reales de tu sistema.
curl -X POST "${base}/datos" \\
  -H "X-API-Key: ${apiKeyIntegrador}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "datoId": "REG-001",
    "tipo": "${entityType}",
    "payload": ${payloadForCurl}
  }'`,
      update: `# EJEMPLO ILUSTRATIVO: envia el snapshot COMPLETO actualizado, no solo el campo que cambio.
curl -X PUT "${base}/datos/REG-001" \\
  -H "X-API-Key: ${apiKeyIntegrador}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "datoId": "REG-001",
    "tipo": "${entityType}",
    "payload": ${payloadForCurl}
  }'`,
      history: `# EJEMPLO ILUSTRATIVO: consulta de todas las versiones registradas de un dato.
curl -X GET "${base}/datos/REG-001/historial" \\
  -H "X-API-Key: ${apiKeyLectura}"`,
      restore: `# EJEMPLO ILUSTRATIVO: el txId se obtiene del historial; solo el rol admin puede restaurar.
curl -X POST "${base}/datos/REG-001/restaurar" \\
  -H "X-API-Key: ${apiKeyAdmin}" \\
  -H "Content-Type: application/json" \\
  -d '{ "txId": "TXID_A_RESTAURAR" }'`,
    }
  }, [baseUrl, apiKeyIntegrador, apiKeyLectura, apiKeyAdmin, entityType, effectiveSchemaVersion, payloadExampleText])

  const dataContractSnippet = useMemo(
    () => `{
  "datoId": "ID_UNICO_NEGOCIO",
  "tipo": "${entityType}",
  "payload": {
    "schemaVersion": "${effectiveSchemaVersion}",
    "...": "aqui van los atributos que definiste abajo"
  }
}`,
    [entityType, effectiveSchemaVersion],
  )

  const payloadTemplateSnippet = useMemo(
    () => payloadExampleText,
    [payloadExampleText],
  )

  const backendIntegrationSnippet = useMemo(() => {
    const base = baseUrl.replace(/\/+$/, '')
    return `// EJEMPLO ILUSTRATIVO (JavaScript / Node.js).
// La integracion funciona desde cualquier lenguaje que haga peticiones HTTP
// (PHP, Python, Java, C#, Go...). Tu backend llama al middleware; el
// middleware NUNCA llama a tu backend, no necesitas exponer endpoints.

const BAAS_URL = '${base}';            // URL del api-middleware
const BAAS_API_KEY = '${apiKeyIntegrador}'; // API key con rol integrador

// Llama a esta funcion en tu backend cada vez que crees o edites
// el registro que quieres volver inmutable (ej. despues de guardar en tu BD).
async function registrarEnBlockchain(registro) {
  const res = await fetch(\`\${BAAS_URL}/datos/\${registro.id}\`, {
    method: 'PUT', // usa POST /datos para el alta inicial
    headers: {
      'X-API-Key': BAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      datoId: registro.id,          // tu ID de negocio
      tipo: '${entityType}',
      payload: {
        schemaVersion: '${effectiveSchemaVersion}',
        // mapea aqui los atributos de TU sistema (los del paso 4)
        ...registro,
      },
    }),
  });
  if (!res.ok) throw new Error(\`BaaS error \${res.status}\`);
  return res.json(); // incluye el txId registrado en blockchain
}`
  }, [baseUrl, apiKeyIntegrador, entityType, effectiveSchemaVersion])

  const apiMiddlewareEnvSnippet = useMemo(
    () => `TENANTS_FILE=./config/tenants.yaml
CORS_ORIGINS=http://localhost:5173
PORT=3000`,
    [],
  )

  const webPortalApiEnvSnippet = useMemo(
    () => `PORT=3001
JWT_SECRET=cambiar-esto-en-local
DATABASE_PATH=./data/portal.db
API_MIDDLEWARE_URL=${baseUrl.replace(/\/+$/, '')}
USUARIOS_ADMIN_FILE=./config/usuarios-admin.yaml`,
    [baseUrl],
  )

  const runCommandsSnippet = useMemo(
    () => `# 1) Levantar api-middleware
cd api-middleware
go mod tidy
go run ./cmd/server

# 2) Levantar web-portal-api (BFF + login)
cd ../web-portal-api
go mod tidy
go run ./cmd/server

# 3) Generar hash bcrypt para usuarios del archivo usuarios-admin.yaml
cd ../web-portal-api
go run ./cmd/bcrypt-gen "mi-password-seguro"`,
    [],
  )

  const isolationValidationSnippet = useMemo(
    () => `# Crear dato en tenant actual
curl -X POST "${baseUrl.replace(/\/+$/, '')}/datos" \\
  -H "X-API-Key: ${apiKeyIntegrador}" \\
  -H "Content-Type: application/json" \\
  -d '{"datoId":"REG-ISOLATION-1","tipo":"${entityType}","payload":{"schemaVersion":"${schemaVersion}","estado":"ok"}}'

# Leer historial del mismo dato
curl -H "X-API-Key: ${apiKeyLectura}" \\
  "${baseUrl.replace(/\/+$/, '')}/datos/REG-ISOLATION-1/historial"

# Prueba negativa: ruta legacy eliminada (debe responder 404)
curl -X POST "${baseUrl.replace(/\/+$/, '')}/clientes" \\
  -H "X-API-Key: ${apiKeyIntegrador}" \\
  -H "Content-Type: application/json" \\
  -d '{"clienteId":"CLI-001","nombre":"No aplica"}'
# Esperado: 404 — el modelo universal usa POST /datos`,
    [baseUrl, apiKeyIntegrador, apiKeyLectura, entityType, schemaVersion],
  )

  const fullGuideMarkdown = useMemo(
    () => `# Guia de onboarding - ${tenantName}

## 1) Identidad del tenant
- tenant_id: \`${tenantId}\`
- nombre: ${tenantName}
- descripcion: ${description}
- canal: ${channel}
- chaincode: ${chaincode}
- msp_id: ${mspId}

## 2) Snippet tenants.yaml (api-middleware)
\`\`\`yaml
${tenantsYamlSnippet}
\`\`\`

## 3) .env recomendado api-middleware
\`\`\`env
${apiMiddlewareEnvSnippet}
\`\`\`

## 4) Snippet usuarios-admin.yaml (web-portal-api)
\`\`\`yaml
${usuariosAdminYamlSnippet}
\`\`\`

## 5) .env recomendado web-portal-api
\`\`\`env
${webPortalApiEnvSnippet}
\`\`\`

## 6) Contrato de datos
\`\`\`json
${dataContractSnippet}
\`\`\`

### Payload de ejemplo
\`\`\`json
${payloadTemplateSnippet}
\`\`\`

## 7) Comandos operativos
\`\`\`bash
${runCommandsSnippet}
\`\`\`

## 8) Validacion tecnica (ejemplos ilustrativos)
> Los cURL siguientes son ejemplos para validar la conexion. En produccion,
> tu backend hace estas mismas llamadas HTTP desde codigo (ver seccion 8.1).

\`\`\`bash
${curlExamples.create}
\`\`\`

\`\`\`bash
${curlExamples.update}
\`\`\`

\`\`\`bash
${curlExamples.history}
\`\`\`

\`\`\`bash
${curlExamples.restore}
\`\`\`

## 8.1) Integracion desde tu backend
El BaaS no llama a tu sistema: tu backend es quien envia los datos al middleware.
No necesitas exponer endpoints nuevos; solo agregar una llamada HTTP donde guardas tus registros.

\`\`\`javascript
${backendIntegrationSnippet}
\`\`\`

## 9) Validacion de aislamiento multi-tenant
\`\`\`bash
${isolationValidationSnippet}
\`\`\`

## 10) Checklist final
- [ ] tenant agregado en \`api-middleware/config/tenants.yaml\`
- [ ] usuarios y api keys alineados en \`web-portal-api/config/usuarios-admin.yaml\`
- [ ] bcrypt actualizado para cada usuario y BFF reiniciado
- [ ] cURL de alta/edicion/historial/restauracion validado
- [ ] prueba negativa de aislamiento ejecutada correctamente
`,
    [
      tenantName,
      tenantId,
      description,
      channel,
      chaincode,
      mspId,
      tenantsYamlSnippet,
      apiMiddlewareEnvSnippet,
      usuariosAdminYamlSnippet,
      webPortalApiEnvSnippet,
      dataContractSnippet,
      payloadTemplateSnippet,
      runCommandsSnippet,
      curlExamples.create,
      curlExamples.update,
      curlExamples.history,
      curlExamples.restore,
      backendIntegrationSnippet,
      isolationValidationSnippet,
    ],
  )

  const applyTemplate = (templateId: string) => {
    const template = PAYLOAD_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return
    setSelectedTemplateId(template.id)
    setEntityType(template.entityType)
    setSchemaVersion(template.schemaVersion)
    const nextAttributes = withIds(template.attributes)
    setAttributes(nextAttributes)
    setPayloadExampleText(buildPayloadFromAttributes(nextAttributes, template.schemaVersion))
  }

  const syncPayloadFromAttributes = (nextAttributes: AttributeDraft[], nextSchemaVersion: string) => {
    setPayloadExampleText(buildPayloadFromAttributes(nextAttributes, nextSchemaVersion))
  }

  const addAttribute = () => {
    const nextAttributes: AttributeDraft[] = [
      ...attributes,
      { id: crypto.randomUUID(), name: '', type: 'texto' as AttributeType, example: '' },
    ]
    setAttributes(nextAttributes)
    syncPayloadFromAttributes(nextAttributes, schemaVersion)
  }

  const removeAttribute = (id: string) => {
    const nextAttributes = attributes.filter((attr) => attr.id !== id)
    setAttributes(nextAttributes)
    syncPayloadFromAttributes(nextAttributes, schemaVersion)
  }

  const updateAttribute = (id: string, patch: Partial<AttributeDraft>) => {
    const nextAttributes = attributes.map((attr) => (attr.id === id ? { ...attr, ...patch } : attr))
    setAttributes(nextAttributes)
    syncPayloadFromAttributes(nextAttributes, schemaVersion)
  }

  const handleSchemaVersionChange = (value: string) => {
    setSchemaVersion(value)
    syncPayloadFromAttributes(attributes, value)
  }

  const addUser = () => {
    setUsers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        username: '',
        fullName: '',
        role: 'lectura',
        passwordHint: '',
      },
    ])
  }

  const removeUser = (id: string) => setUsers((prev) => prev.filter((u) => u.id !== id))

  const updateUser = (id: string, patch: Partial<UserDraft>) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

  const regenerateKeys = () => {
    setApiKeyAdmin(randomKey('admin'))
    setApiKeyIntegrador(randomKey('int'))
    setApiKeyLectura(randomKey('lect'))
  }

  const next = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1))
  const prev = () => setActiveStep((s) => Math.max(s - 1, 0))
  const applyLocalFabricDefaults = () => {
    setMspId('Org1MSP')
    setPeerEndpoint('localhost:7051')
    setPeerHostAlias('peer0.org1.example.com')
    setCertPath(
      './red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem',
    )
    setKeyPathDir(
      './red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore',
    )
    setTlsCertPath(
      './red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt',
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="text-sm font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">
            Nexum
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-[#6b7280] transition-colors hover:text-[#1a3a5c]"
          >
            Ir al panel privado
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <p className="text-sm font-medium text-[#c48f12]">Onboarding guiado</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-[#1a2332] sm:text-3xl">
              Conecta tu backend al BaaS en 5 pasos
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-snug text-[#6b7280]">
              Avanza con <strong className="font-semibold text-[#374151]">Siguiente</strong>, revisa cada paso y copia
              los snippets listos para tu integración.
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-[#1a3a5c]/15 bg-[#1a3a5c] px-5 py-3 text-white shadow-sm">
            <p className="text-sm font-semibold leading-snug">Documentación de integración</p>
            <p className="mt-1 text-xs leading-snug text-white/75">
              Descarga la guía técnica del onboarding (actualmente en desarrollo).
            </p>
            {integrationGuideUrl.trim() ? (
              <a
                className="mt-2.5 inline-flex w-full items-center justify-center rounded-full bg-[#f0b429] px-4 py-2 text-xs font-bold text-[#1a2332] transition-colors hover:bg-[#f5c24a]"
                href={integrationGuideUrl}
                target="_blank"
                rel="noreferrer"
              >
                Descargar documentación
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mt-2.5 w-full cursor-not-allowed rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/50"
                title="Disponible cuando se publique el documento final"
              >
                Próximamente
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <section className="min-w-0 rounded-3xl border border-line/60 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 lg:hidden">
              <div className="flex items-center justify-between text-xs text-[#6b7280]">
                <span>
                  Paso {activeStep + 1} de {steps.length}
                </span>
                <span className="font-medium text-[#1a3a5c]">{steps[activeStep].title}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8edf3]">
                <div
                  className="h-full rounded-full bg-[#1a3a5c] transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          {activeStep === 0 ? (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-[#1a2332]">Paso 1 · Configurar tenant</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                Define la identidad del tenant y cómo se conectará a la red. Si no tienes experiencia en blockchain, usa el
                modo básico con valores automáticos del proyecto.
              </p>
              <StepIntro
                title="¿Qué estás creando en este paso?"
                lines={[
                  'Un "tenant" es tu espacio privado dentro del BaaS: tu empresa o sistema, con su propio canal de blockchain aislado de otros clientes.',
                  'Lo que configures aquí se convierte en un bloque de texto (snippet) que pegarás en el archivo tenants.yaml del middleware en el paso 5.',
                  'El BaaS usa estos datos para saber a qué canal y contrato dirigir cada petición que llegue con tu API key.',
                ]}
              />
              <div className="mt-5 rounded-2xl border border-[#1a3a5c]/12 bg-[#1a3a5c]/5 px-5 py-4">
                <p className="text-sm font-semibold text-[#1a3a5c]">¿Qué debes tener a mano?</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#4b5563]">
                  <li>- Nombre e ID corto del tenant (ej. `agricultura`, `erp-universidad`).</li>
                  <li>- Si usarás el proyecto tal cual, basta con los valores automáticos (modo básico).</li>
                  <li>- Solo en modo avanzado deberás editar parámetros técnicos de Fabric.</li>
                </ul>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFabricMode('basic')}
                  className={[
                    'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                    fabricMode === 'basic'
                      ? 'border-accent bg-accent/10 text-accent-ink'
                      : 'border-line bg-gray-50 text-ink-secondary hover:bg-gray-100',
                  ].join(' ')}
                >
                  Modo básico (recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setFabricMode('advanced')}
                  className={[
                    'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                    fabricMode === 'advanced'
                      ? 'border-accent bg-accent/10 text-accent-ink'
                      : 'border-line bg-gray-50 text-ink-secondary hover:bg-gray-100',
                  ].join(' ')}
                >
                  Modo avanzado
                </button>
                <button
                  type="button"
                  onClick={applyLocalFabricDefaults}
                  className="rounded-md border border-line bg-gray-50 px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-gray-100"
                >
                  Usar valores automáticos del proyecto
                </button>
              </div>
              {fabricMode === 'basic' ? (
                <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-5 py-4 text-sm leading-relaxed text-emerald-900/90">
                  Estás en modo básico: el usuario solo define datos funcionales del tenant y usa conexión Fabric
                  preconfigurada.
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-sm leading-relaxed text-amber-900/90">
                  Estás en modo avanzado: edita MSP, peer y rutas de certificados solo si conoces tu topología Fabric.
                </div>
              )}
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field
                  label="ID del tenant"
                  help="Identificador tecnico unico (sin espacios). Se usa como clave en tenants.yaml."
                  value={tenantId}
                  onChange={setTenantId}
                  placeholder="cliente-erp"
                />
                <Field
                  label="Nombre visible del tenant"
                  help="Nombre amigable que vera el usuario en la consola."
                  value={tenantName}
                  onChange={setTenantName}
                  placeholder="Cliente ERP"
                />
                <Field
                  label="Descripcion de integracion"
                  help="Texto corto para explicar que sistema conecta este tenant."
                  value={description}
                  onChange={setDescription}
                  placeholder="Integracion de sistema ERP"
                />
                <Field
                  label="Canal de Fabric"
                  help="Nombre del canal blockchain asignado al tenant."
                  value={channel}
                  onChange={setChannel}
                  placeholder="canal-erp"
                />
                <Field
                  label="Chaincode de datos"
                  help="Smart contract usado para guardar datos. Normalmente dato_cc."
                  value={chaincode}
                  onChange={setChaincode}
                  placeholder="dato_cc"
                />
                {fabricMode === 'advanced' ? (
                  <>
                    <Field
                      label="MSP ID"
                      help="Identidad MSP de la organizacion (ej. Org1MSP)."
                      value={mspId}
                      onChange={setMspId}
                      placeholder="Org1MSP"
                    />
                    <Field
                      label="Endpoint del peer"
                      help="Host:puerto del peer (ej. localhost:7051)."
                      value={peerEndpoint}
                      onChange={setPeerEndpoint}
                      placeholder="localhost:7051"
                    />
                    <Field
                      label="Alias TLS del peer"
                      help="Nombre DNS del peer usado en certificados TLS."
                      value={peerHostAlias}
                      onChange={setPeerHostAlias}
                      placeholder="peer0.org1.example.com"
                    />
                    <Field
                      label="Ruta del certificado (cert_path)"
                      help="Ruta al certificado signcerts/cert.pem del admin del tenant."
                      value={certPath}
                      onChange={setCertPath}
                      placeholder="/ruta/a/signcerts/cert.pem"
                    />
                    <Field
                      label="Ruta del keystore (key_path_dir)"
                      help="Carpeta keystore que contiene la llave privada del admin."
                      value={keyPathDir}
                      onChange={setKeyPathDir}
                      placeholder="/ruta/a/keystore"
                    />
                    <Field
                      label="Ruta del TLS CA (tls_cert_path)"
                      help="Certificado TLS del peer: tls/ca.crt."
                      value={tlsCertPath}
                      onChange={setTlsCertPath}
                      placeholder="/ruta/a/tls/ca.crt"
                    />
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <div className="rounded-md border border-line bg-canvas p-3 text-xs text-ink-secondary">
                      <p className="font-semibold text-ink">Conexión técnica aplicada automáticamente</p>
                      <p className="mt-1">
                        MSP: <code>{mspId}</code> · Peer: <code>{peerEndpoint}</code> · Alias TLS:{' '}
                        <code>{peerHostAlias}</code>
                      </p>
                      <p className="mt-1 text-muted">
                        Puedes editar estos valores cambiando a modo avanzado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-[#1a2332]">Paso 2 · API keys por rol</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                Estas claves se usan para autorización y deben coincidir en middleware y BFF.
              </p>
              <StepIntro
                title="¿Qué estás creando en este paso?"
                lines={[
                  'Tres credenciales secretas (una por rol) que tu sistema enviará en la cabecera X-API-Key de cada petición HTTP.',
                  'Admin: gestiona todo e incluye la restauración lógica. Integrador: la usará tu backend para crear y editar datos. Lectura: solo consultas (auditoría, historial).',
                  'La key identifica a tu tenant: con ella el BaaS sabe quién eres y qué puedes hacer, sin que manejes certificados de Fabric.',
                ]}
              />
              <ExampleNotice text="Las keys generadas aquí son de ejemplo para el entorno local. Puedes regenerarlas o escribir las tuyas; lo importante es que la misma key quede registrada en tenants.yaml (paso 5) y se mantenga en secreto." />
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <Field label="Key admin" value={apiKeyAdmin} onChange={setApiKeyAdmin} placeholder="admin-xxxx" />
                <Field label="Key integrador" value={apiKeyIntegrador} onChange={setApiKeyIntegrador} placeholder="int-xxxx" />
                <Field label="Key lectura" value={apiKeyLectura} onChange={setApiKeyLectura} placeholder="lect-xxxx" />
              </div>
              <button
                type="button"
                className="mt-4 rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-canvas"
                onClick={regenerateKeys}
              >
                Regenerar keys
              </button>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-[#1a2332]">Paso 3 · Usuarios de consola</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                Usuarios que podrán iniciar sesión en `web-cliente-demo`.
              </p>
              <StepIntro
                title="¿Qué estás creando en este paso?"
                lines={[
                  'Cuentas con usuario y contraseña para las PERSONAS de tu equipo que entrarán a la consola web de auditoría.',
                  'Son distintas de las API keys del paso 2: las keys las usa tu backend (máquina a máquina); estos usuarios los usan personas en el navegador.',
                  'Cada usuario hereda un rol (admin, integrador o lectura) que define qué pantallas y acciones ve en la consola.',
                ]}
              />
              <ExampleNotice text="Los usuarios y contraseñas precargados son de ejemplo. Cámbialos por los de tu equipo; la contraseña real se define al generar el hash bcrypt en el paso 5." />
              <div className="mt-6 space-y-4">
                {users.map((u) => (
                  <div key={u.id} className="rounded-2xl border border-line/60 bg-[#fafbfd] p-5">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Field
                        label="Usuario"
                        value={u.username}
                        onChange={(v) => updateUser(u.id, { username: v })}
                        placeholder="usuario_login"
                      />
                      <Field
                        label="Nombre completo"
                        value={u.fullName}
                        onChange={(v) => updateUser(u.id, { fullName: v })}
                        placeholder="Nombre Apellido"
                      />
                      <Field
                        label="Contraseña de referencia"
                        value={u.passwordHint}
                        onChange={(v) => updateUser(u.id, { passwordHint: v })}
                        placeholder="password-temporal"
                      />
                      <label className="text-xs font-medium text-muted">
                        Rol
                        <select
                          className={`${inputClass} mt-1`}
                          value={u.role}
                          onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                        >
                          <option value="admin">admin</option>
                          <option value="integrador">integrador</option>
                          <option value="lectura">lectura</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="mt-3 rounded-md border border-danger/35 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger-ink hover:bg-danger-soft/80"
                      onClick={() => removeUser(u.id)}
                    >
                      Eliminar usuario
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-canvas"
                onClick={addUser}
              >
                Agregar usuario
              </button>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-[#1a2332]">Paso 4 · Contrato de datos (payload v1)</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                El BaaS es genérico, pero cada cliente debe definir su contrato de payload y versionarlo.
              </p>
              <StepIntro
                title="¿Qué estás definiendo en este paso?"
                lines={[
                  'Aquí decides QUÉ datos de tu sistema quieres volver inmutables en blockchain.',
                  'Lista los atributos de tu registro (nombre, tipo y un valor de ejemplo) y el JSON se arma solo.',
                  'Ese JSON es el "contrato de datos": la estructura exacta que tu backend enviará en cada alta o edición.',
                ]}
              />
              <ExampleNotice text="Las plantillas (Agro, ERP, Académico) y todos los valores que ves son SOLO EJEMPLOS para que entiendas el formato. Reemplázalos por los atributos reales de tu propio sistema." />
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="block text-xs font-medium text-[#6b7280]">
                  <span className="mb-1.5 flex items-center gap-2 text-[#374151]">
                    <span>Plantilla de ejemplo (punto de partida)</span>
                    <HelpTooltip text="Selecciona la plantilla más parecida a tu negocio y modifícala. No es obligatorio usar ninguna: puedes borrar los atributos y crear los tuyos desde cero." />
                  </span>
                  <select
                    className={inputClass}
                    value={selectedTemplateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    {PAYLOAD_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Tipo de entidad (`tipo`)"
                  help="Nombre que identifica el tipo de registro de TU negocio dentro del BaaS. Ejemplos: factura, expediente, orden_compra. Usa minúsculas y guion bajo."
                  value={entityType}
                  onChange={setEntityType}
                  placeholder="registro_externo"
                />
                <Field
                  label="Versión de schema (`payload.schemaVersion`)"
                  help="Versión de la estructura del payload. Empieza en v1. Si más adelante agregas o quitas atributos, sube a v2 para distinguir registros antiguos de nuevos."
                  value={schemaVersion}
                  onChange={handleSchemaVersionChange}
                  placeholder="v1"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-line/60 bg-[#fafbfd]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2332]">Atributos inmutables de tu registro</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                      Agrega los campos de tu sistema que quieres proteger en blockchain. El JSON de abajo se genera
                      automáticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-[#1a3a5c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2844]"
                    onClick={addAttribute}
                  >
                    + Agregar atributo
                  </button>
                </div>
                <div className="space-y-4 p-5">
                  {attributes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-[#6b7280]">
                      Sin atributos. Agrega al menos uno (por ejemplo: codigo, estado, monto...).
                    </p>
                  ) : (
                    attributes.map((attr) => (
                      <div
                        key={attr.id}
                        className="rounded-2xl border border-line/60 bg-white p-4 shadow-sm sm:p-5"
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="text-xs font-medium text-[#6b7280]">
                            Nombre del atributo
                            <input
                              className={`${inputClass} mt-1.5`}
                              value={attr.name}
                              onChange={(e) => updateAttribute(attr.id, { name: e.target.value })}
                              placeholder="ej. codigo"
                            />
                          </label>
                          <label className="text-xs font-medium text-[#6b7280]">
                            Tipo
                            <select
                              className={`${inputClass} mt-1.5`}
                              value={attr.type}
                              onChange={(e) => updateAttribute(attr.id, { type: e.target.value as AttributeType })}
                            >
                              {(Object.keys(ATTRIBUTE_TYPE_LABELS) as AttributeType[]).map((type) => (
                                <option key={type} value={type}>
                                  {ATTRIBUTE_TYPE_LABELS[type]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="mt-4 block text-xs font-medium text-[#6b7280]">
                          Valor de ejemplo
                          {attr.type === 'lista' ? (
                            <textarea
                              className={`${textareaClass} mt-1.5 min-h-28 font-mono text-xs`}
                              value={attr.example}
                              onChange={(e) => updateAttribute(attr.id, { example: e.target.value })}
                              placeholder='[{"id":"ITEM-1","nombre":"Ejemplo"}]'
                              rows={4}
                            />
                          ) : (
                            <input
                              className={`${inputClass} mt-1.5`}
                              value={attr.example}
                              onChange={(e) => updateAttribute(attr.id, { example: e.target.value })}
                              placeholder="ej. FAC-001"
                            />
                          )}
                        </label>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                            onClick={() => removeAttribute(attr.id)}
                          >
                            Quitar atributo
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <label className="block flex-1 text-xs font-medium text-muted">
                  Payload generado (puedes ajustarlo a mano)
                </label>
                <button
                  type="button"
                  className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-secondary hover:bg-canvas"
                  onClick={() => syncPayloadFromAttributes(attributes, schemaVersion)}
                >
                  Regenerar desde atributos
                </button>
              </div>
              <textarea
                className={`${textareaClass} mt-2 min-h-56 font-mono text-xs`}
                value={payloadExampleText}
                onChange={(e) => setPayloadExampleText(e.target.value)}
                rows={12}
              />
              <p className="mt-1 text-[11px] text-muted">
                Nota: si editas un atributo arriba, el JSON se vuelve a generar y se pierden los ajustes manuales.
              </p>
              <Checklist
                items={[
                  'Definir campos obligatorios de negocio en payload',
                  'Versionar payload con schemaVersion',
                  'Evitar enviar toda la BD: solo snapshot necesario',
                  'Mantener tipos estables (string, number, arrays, fechas ISO)',
                  'Documentar mapeo desde sistema cliente al payload',
                ]}
              />
              <SnippetBlock
                title="Contrato base (envoltura dato_cc) — estructura fija del BaaS"
                value={dataContractSnippet}
                onCopy={() => copyToClipboard(dataContractSnippet)}
              />
              <SnippetBlock
                title="Tu payload de ejemplo (generado con tus atributos)"
                value={payloadTemplateSnippet}
                onCopy={() => copyToClipboard(payloadTemplateSnippet)}
              />
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-[#1a2332]">Paso 5 · Probar y entregar</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                Este paso entrega el paquete completo: configuración, comandos de arranque, validación y guía final.
              </p>
              <StepIntro
                title="¿Qué estás haciendo en este paso?"
                lines={[
                  'Primero validas la conexión con cURL (pruebas manuales desde la terminal, sin tocar tu código).',
                  'Cuando los cURL respondan bien, llevas esa misma llamada HTTP a tu backend con el código de ejemplo de abajo.',
                  'Tu backend es quien llama al BaaS; el BaaS nunca llama a tu sistema, así que no necesitas crear ni exponer endpoints nuevos.',
                ]}
              />
              <ExampleNotice text="Los cURL son EJEMPLOS ILUSTRATIVOS para probar que todo funciona, no comandos que debas usar tal cual en producción. El payload mostrado es el que definiste en el paso 4; reemplaza datoId y los valores por los datos reales de tu sistema cuando programes la integración." />
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field label="URL base del api-middleware" value={baseUrl} onChange={setBaseUrl} placeholder="http://localhost:3000" />
                <Field label="URL del repositorio" value={repoUrl} onChange={setRepoUrl} placeholder="https://github.com/tu-org/proyecto-blockchain" />
              </div>
              <Checklist
                items={[
                  'Agregar snippet del tenant en api-middleware/config/tenants.yaml',
                  'Configurar .env de api-middleware con TENANTS_FILE',
                  'Agregar claves y usuarios en web-portal-api/config/usuarios-admin.yaml',
                  'Configurar .env de web-portal-api y URL al middleware',
                  'Generar bcrypt de cada usuario y reiniciar web-portal-api',
                  'Validar cURL de alta, edición, historial y restauración',
                  'Ejecutar prueba de aislamiento multi-tenant (error esperado)',
                  'Entregar URL del repo y pasos mínimos de despliegue',
                ]}
              />
              <SnippetBlock
                title=".env recomendado (api-middleware)"
                value={apiMiddlewareEnvSnippet}
                onCopy={() => copyToClipboard(apiMiddlewareEnvSnippet)}
              />
              <SnippetBlock
                title=".env recomendado (web-portal-api)"
                value={webPortalApiEnvSnippet}
                onCopy={() => copyToClipboard(webPortalApiEnvSnippet)}
              />
              <SnippetBlock
                title="Comandos operativos (arranque + bcrypt)"
                value={runCommandsSnippet}
                onCopy={() => copyToClipboard(runCommandsSnippet)}
              />
              <SnippetBlock
                title="Snippet para tenants.yaml (api-middleware)"
                value={tenantsYamlSnippet}
                onCopy={() => copyToClipboard(tenantsYamlSnippet)}
              />
              <SnippetBlock
                title="Snippet para usuarios-admin.yaml (web-portal-api)"
                value={usuariosAdminYamlSnippet}
                onCopy={() => copyToClipboard(usuariosAdminYamlSnippet)}
              />
              <SnippetBlock title="cURL de ejemplo: crear dato" value={curlExamples.create} onCopy={() => copyToClipboard(curlExamples.create)} />
              <SnippetBlock title="cURL de ejemplo: editar dato" value={curlExamples.update} onCopy={() => copyToClipboard(curlExamples.update)} />
              <SnippetBlock title="cURL de ejemplo: historial" value={curlExamples.history} onCopy={() => copyToClipboard(curlExamples.history)} />
              <SnippetBlock
                title="cURL de ejemplo: restauración lógica (admin)"
                value={curlExamples.restore}
                onCopy={() => copyToClipboard(curlExamples.restore)}
              />
              <SnippetBlock
                title="Conectar tu backend: código de ejemplo (adaptable a cualquier lenguaje)"
                value={backendIntegrationSnippet}
                onCopy={() => copyToClipboard(backendIntegrationSnippet)}
              />
              <SnippetBlock
                title="Prueba de aislamiento multi-tenant"
                value={isolationValidationSnippet}
                onCopy={() => copyToClipboard(isolationValidationSnippet)}
              />
              <div className="mt-4 rounded-md border border-line bg-canvas p-3">
                <p className="text-xs text-muted">Repo para entrega</p>
                <a className="text-sm font-semibold text-accent-ink hover:underline" href={repoUrl} target="_blank" rel="noreferrer">
                  {repoUrl}
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-[#1a3a5c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2844]"
                  onClick={() => downloadTextFile(`guia-onboarding-${tenantId || 'tenant'}.md`, fullGuideMarkdown)}
                >
                  Descargar guia completa (.md)
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#f9fafb]"
                  onClick={() => copyToClipboard(fullGuideMarkdown)}
                >
                  Copiar guia completa
                </button>
              </div>
            </div>
          ) : null}

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-line/60 pt-6">
              <button
                type="button"
                onClick={prev}
                disabled={activeStep === 0}
                className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={next}
                disabled={activeStep === steps.length - 1}
                className="rounded-full bg-[#1a3a5c] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f2844] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-3xl border border-line/60 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Progreso</p>
              <p className="mt-1 text-lg font-bold text-[#1a2332]">{steps[activeStep].title}</p>
              <div className="mt-4 hidden h-1.5 w-full overflow-hidden rounded-full bg-[#e8edf3] lg:block">
                <div
                  className="h-full rounded-full bg-[#f0b429] transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <ol className="mt-6 space-y-1">
                {steps.map((step, idx) => {
                  const active = idx === activeStep
                  const done = idx < activeStep
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStep(idx)}
                        className={[
                          'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all',
                          active
                            ? 'bg-[#1a3a5c]/8 ring-1 ring-[#1a3a5c]/15'
                            : 'hover:bg-[#f4f7fb]',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            done
                              ? 'bg-emerald-500 text-white'
                              : active
                                ? 'bg-[#1a3a5c] text-white'
                                : 'bg-[#e8edf3] text-[#6b7280]',
                          ].join(' ')}
                        >
                          {done ? '✓' : idx + 1}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={[
                              'block text-sm font-semibold leading-snug',
                              active ? 'text-[#1a3a5c]' : 'text-[#374151]',
                            ].join(' ')}
                          >
                            {step.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#9ca3af]">
                            {step.subtitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              <Link
                className="mt-5 block text-center text-xs font-medium text-[#1a3a5c] hover:underline"
                to="/login"
              >
                Ya tengo cuenta, ir al panel privado
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string
  help?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block text-xs font-medium text-[#6b7280]">
      <span className="mb-1.5 flex items-center gap-2 text-[#374151]">
        <span>{label}</span>
        {help ? <HelpTooltip text={help} /> : null}
      </span>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line bg-gray-50 text-[10px] font-bold text-ink-secondary hover:bg-gray-100"
        aria-label="Mostrar ayuda del campo"
      >
        ?
      </button>
      {open ? (
        <span className="absolute left-0 top-6 z-20 w-64 rounded-md border border-line bg-surface p-2 text-[11px] font-normal leading-4 text-ink-secondary shadow-card">
          {text}
        </span>
      ) : null}
    </span>
  )
}

function StepIntro({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#1a3a5c]/10 bg-[#f4f7fb] px-5 py-4">
      <p className="text-sm font-semibold text-[#1a2332]">{title}</p>
      <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#4b5563]">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0b429]" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExampleNotice({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4">
      <p className="text-sm font-semibold text-amber-900">Valores de ejemplo</p>
      <p className="mt-2 text-sm leading-relaxed text-amber-800/90">{text}</p>
    </div>
  )
}

function Checklist({ items }: { items: string[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#1a3a5c]/12 bg-[#1a3a5c]/5 px-5 py-4">
      <p className="text-sm font-semibold text-[#1a3a5c]">Checklist sugerido</p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#4b5563]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[#1a3a5c]">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SnippetBlock({
  title,
  value,
  onCopy,
}: {
  title: string
  value: string
  onCopy: () => void
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line/60 bg-[#fafbfd]">
      <div className="flex items-center justify-between gap-3 border-b border-line/60 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-[#1a2332]">{title}</p>
        <button
          type="button"
          className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f9fafb]"
          onClick={onCopy}
        >
          Copiar
        </button>
      </div>
      <pre className="max-h-80 overflow-auto px-4 py-4 text-xs leading-relaxed text-[#374151]">{value}</pre>
    </div>
  )
}

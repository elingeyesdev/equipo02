import { useMemo, useState } from 'react'
import {
  buildCurlExamples,
  buildEnvSnippet,
  buildIntegratorGuideMarkdown,
  buildLaravelClientSnippet,
  buildLaravelConfigSnippet,
  buildLaravelControllerSnippet,
  buildLaravelModelSnippet,
  buildLaravelRoutesSnippet,
  buildNodeClientSnippet,
  buildNodeHookSnippet,
  type OnboardingContext,
  type StackTarget,
} from '../../lib/onboardingSnippets'
import { SnippetBlock, copyToClipboard, downloadTextFile } from '../onboarding/OnboardingUi'

type TabId = 'controller' | 'model' | 'client' | 'config' | 'routes' | 'env' | 'curl' | 'node'

type Props = {
  ctx: OnboardingContext
  stack: StackTarget
  keysPending?: boolean
  showTestButton?: boolean
  repoUrl?: string
  downloadName?: string
}

async function testPostDatos(ctx: OnboardingContext): Promise<string> {
  const base = ctx.baseUrl.replace(/\/+$/, '')
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(ctx.payloadExampleText) as Record<string, unknown>
  } catch {
    payload = { schemaVersion: ctx.schemaVersion, estado: 'activo' }
  }
  const datoId = `TEST-${Date.now()}`
  const res = await fetch(`${base}/datos`, {
    method: 'POST',
    headers: {
      'X-API-Key': ctx.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ datoId, tipo: ctx.entityType, payload }),
  })
  const body = await res.json().catch(() => ({}))
  return `HTTP ${res.status}\n${JSON.stringify(body, null, 2)}`
}

export default function IntegrationCodePanel({
  ctx,
  stack,
  keysPending = false,
  showTestButton = false,
  repoUrl = '',
  downloadName = 'integracion',
}: Props) {
  const [tab, setTab] = useState<TabId>(stack === 'laravel' ? 'controller' : stack === 'nodejs' ? 'node' : 'curl')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const curls = useMemo(() => buildCurlExamples(ctx), [ctx])
  const guideMd = useMemo(() => buildIntegratorGuideMarkdown(ctx, curls, repoUrl), [ctx, curls, repoUrl])

  const laravelTabs: { id: TabId; label: string; value: string }[] = [
    { id: 'controller', label: 'Controller', value: buildLaravelControllerSnippet(ctx) },
    { id: 'model', label: 'Modelo', value: buildLaravelModelSnippet(ctx) },
    { id: 'client', label: 'Cliente', value: buildLaravelClientSnippet(ctx) },
    { id: 'config', label: 'Config', value: buildLaravelConfigSnippet(ctx) },
    { id: 'routes', label: 'Rutas', value: buildLaravelRoutesSnippet(ctx) },
    { id: 'env', label: '.env', value: buildEnvSnippet(ctx) },
  ]

  const activeSnippet = (() => {
    if (stack === 'laravel') {
      return laravelTabs.find((t) => t.id === tab)?.value ?? laravelTabs[0].value
    }
    if (stack === 'nodejs') {
      return tab === 'node'
        ? buildNodeHookSnippet(ctx)
        : buildNodeClientSnippet(ctx)
    }
    if (tab === 'curl') return curls.update
    return curls.create
  })()

  const activeTitle = (() => {
    if (stack === 'laravel') return laravelTabs.find((t) => t.id === tab)?.label ?? 'Controller'
    if (stack === 'nodejs') return tab === 'node' ? 'Hook Node' : 'Cliente Node'
    return tab === 'curl' ? 'cURL actualizar' : 'cURL crear'
  })()

  return (
    <div className="mt-4">
      {keysPending ? (
        <div className="alert alert-warning mb-3" role="alert">
          Las API keys son placeholders hasta que el operador active tu tenant. El código ya está listo para copiar.
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {stack === 'laravel'
          ? laravelTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))
          : null}
        {stack === 'nodejs' ? (
          <>
            <button
              type="button"
              className={`btn btn-sm ${tab !== 'node' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setTab('client')}
            >
              Cliente
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === 'node' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setTab('node')}
            >
              Hook
            </button>
          </>
        ) : null}
        {stack === 'curl' ? (
          <>
            <button
              type="button"
              className={`btn btn-sm ${tab === 'curl' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setTab('curl')}
            >
              cURL crear
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === 'routes' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setTab('routes')}
            >
              cURL actualizar
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn btn-sm btn-outline-primary ms-auto"
          onClick={() => downloadTextFile(`${downloadName}.md`, guideMd)}
        >
          Descargar .md
        </button>
      </div>

      <SnippetBlock
        title={activeTitle}
        value={activeSnippet}
        onCopy={() => copyToClipboard(activeSnippet)}
      />

      {showTestButton ? (
        <div className="card mt-3">
          <div className="card-body">
            <h4 className="card-title">Probar POST /datos</h4>
            <p className="text-secondary small">
              Envía una petición de prueba al middleware con la API key configurada.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={testing || keysPending}
              onClick={() => {
                setTesting(true)
                setTestResult(null)
                void testPostDatos(ctx)
                  .then(setTestResult)
                  .catch((e) => setTestResult(e instanceof Error ? e.message : 'Error de red'))
                  .finally(() => setTesting(false))
              }}
            >
              {testing ? 'Probando…' : 'Probar conexión'}
            </button>
            {testResult ? (
              <pre className="mt-3 mb-0 p-3 bg-light rounded small">{testResult}</pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

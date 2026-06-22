import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  buildCurlExamples,
  buildIntegratorGuideMarkdown,
  buildLaravelHookSnippet,
  buildNodeHookSnippet,
  type StackTarget,
} from '../lib/onboardingSnippets'
import { SnippetBlock, copyToClipboard, downloadTextFile, inputClass } from '../components/onboarding/OnboardingUi'
import { useDevAuth } from '../context/DevAuthContext'
import {
  getDevCredenciales,
  getDevSolicitud,
  type DevTenantRequest,
} from '../services/devPortalApi'

const STATUS_LABELS: Record<string, { title: string; desc: string; color: string }> = {
  pending: {
    title: 'En revisión',
    desc: 'Consulta esta página; se actualiza sola cada pocos segundos. También en Mis solicitudes si iniciaste sesión.',
    color: 'bg-amber-100 text-amber-900',
  },
  provisioning: {
    title: 'Configurando blockchain',
    desc: 'Estamos creando tu canal Fabric y preparando credenciales.',
    color: 'bg-blue-100 text-blue-900',
  },
  active: {
    title: 'Tenant activo',
    desc: 'Ya puedes integrar tu backend con las credenciales reales.',
    color: 'bg-emerald-100 text-emerald-900',
  },
  rejected: {
    title: 'Solicitud rechazada',
    desc: 'Contacta al operador del BaaS para más información.',
    color: 'bg-red-100 text-red-900',
  },
  draft: {
    title: 'Borrador',
    desc: 'Completa y envía la solicitud desde el dev portal.',
    color: 'bg-gray-100 text-gray-800',
  },
}

export default function DevPortalStatusPage() {
  const { id } = useParams<{ id: string }>()
  const { estado: devEstado, usuario } = useDevAuth()
  const [solicitud, setSolicitud] = useState<DevTenantRequest | null>(null)
  const [email, setEmail] = useState('')
  const [credError, setCredError] = useState<string | null>(null)
  const [middlewareUrl, setMiddlewareUrl] = useState('http://localhost:3000')
  const [integradorKey, setIntegradorKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const s = await getDevSolicitud(id)
      setSolicitud(s)
      setEmail(s.contactEmail)
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

  const ctx = useMemo(() => {
    const attrs = solicitud?.integration
    const payload = attrs?.payloadExample ?? '{}'
    return {
      baseUrl: middlewareUrl,
      apiKey: integradorKey ?? `${solicitud?.tenantId ?? 'tenant'}-integrador-PENDIENTE`,
      apiKeyRole: 'integrador' as const,
      entityName: attrs?.entityName ?? 'Entidad',
      businessIdField: attrs?.businessIdField ?? 'id',
      entityType: attrs?.entityType ?? 'registro',
      schemaVersion: attrs?.schemaVersion ?? 'v1',
      payloadExampleText: payload,
    }
  }, [solicitud, middlewareUrl, integradorKey])

  const guideMd = useMemo(() => {
    const curls = buildCurlExamples(ctx)
    return buildIntegratorGuideMarkdown(ctx, curls, '')
  }, [ctx])

  const fetchCredenciales = async (emailArg?: string) => {
    if (!id) return
    setCredError(null)
    try {
      const cred = await getDevCredenciales(id, emailArg)
      setMiddlewareUrl(cred.middlewareUrl)
      setIntegradorKey(cred.keys.integrador ?? null)
    } catch (e) {
      setCredError(e instanceof Error ? e.message : 'No se pudieron obtener credenciales')
    }
  }

  useEffect(() => {
    if (solicitud?.status === 'active' && devEstado === 'autenticado') {
      void fetchCredenciales()
    }
  }, [solicitud?.status, devEstado, id])

  if (loading && !solicitud) {
    return <div className="p-8 text-center text-sm text-[#6b7280]">Cargando estado…</div>
  }

  if (!solicitud) {
    return <div className="p-8 text-center text-sm text-red-600">Solicitud no encontrada</div>
  }

  const statusInfo = STATUS_LABELS[solicitud.status] ?? STATUS_LABELS.draft

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-8">
          <Link to="/dev" className="text-sm font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">
            Nexum Dev Portal
          </Link>
          <Link to="/dev/mis-solicitudes" className="text-sm text-[#6b7280] hover:text-[#1a3a5c]">
            Mis solicitudes
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <div className={`inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${statusInfo.color}`}>
          {statusInfo.title}
        </div>
        <h1 className="mt-3 text-2xl font-bold text-[#1a2332]">{solicitud.orgName}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">tenant: <code>{solicitud.tenantId}</code> · id: {solicitud.id}</p>
        <p className="mt-4 text-sm text-[#6b7280]">{statusInfo.desc}</p>
        {solicitud.status === 'rejected' && solicitud.rejectReason ? (
          <p className="mt-2 text-sm text-red-700">Motivo: {solicitud.rejectReason}</p>
        ) : null}

        {(solicitud.status === 'pending' || solicitud.status === 'provisioning') && (
          <div className="mt-6 rounded-2xl border border-line/60 bg-white p-5 text-sm text-[#6b7280]">
            Mientras esperas, puedes seguir diseñando el payload. Las API keys del paquete serán placeholders hasta la activación.
            {solicitud.integration?.entityType ? (
              <p className="mt-2">Integración prevista: <strong>{solicitud.integration.entityType}</strong> ({solicitud.integration.stack})</p>
            ) : null}
          </div>
        )}

        {solicitud.status === 'active' && (
          <div className="mt-6 rounded-2xl border border-line/60 bg-white p-6">
            <h2 className="text-lg font-bold">Credenciales</h2>
            {devEstado === 'autenticado' ? (
              <p className="mt-1 text-sm text-[#6b7280]">
                Sesión: {usuario?.email}. Las credenciales se cargan automáticamente.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-[#6b7280]">
                  <Link to="/dev/login" className="font-medium text-[#1a3a5c]">Inicia sesión</Link>
                  {' '}con la cuenta que creó la solicitud, o confirma el email (solicitudes antiguas).
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input className={`${inputClass} max-w-xs`} value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button type="button" className="rounded-full bg-[#1a3a5c] px-4 py-2 text-sm font-semibold text-white" onClick={() => void fetchCredenciales(email.trim())}>
                    Obtener credenciales
                  </button>
                </div>
              </>
            )}
            {credError ? <p className="mt-2 text-sm text-red-600">{credError}</p> : null}
            {integradorKey ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-[#6b7280]">URL middleware</dt><dd className="font-mono text-xs">{middlewareUrl}</dd></div>
                <div><dt className="text-[#6b7280]">API key integrador</dt><dd className="font-mono text-xs">{integradorKey}</dd></div>
              </dl>
            ) : null}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-line/60 bg-white p-6">
          <h2 className="text-lg font-bold">Paquete de integración</h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Código generado con tu diseño de payload ({stack}).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="rounded-full bg-[#f0b429] px-4 py-2 text-sm font-bold text-[#1a2332]" onClick={() => downloadTextFile(`integracion-${solicitud.tenantId}.md`, guideMd)}>
              Descargar .md
            </button>
            <Link to="/onboarding" className="rounded-full border border-line px-4 py-2 text-sm font-medium text-[#1a3a5c]">
              Abrir asistente completo
            </Link>
          </div>
          {stack === 'laravel' ? (
            <SnippetBlock title="Hook Laravel" value={buildLaravelHookSnippet(ctx)} onCopy={() => copyToClipboard(buildLaravelHookSnippet(ctx))} />
          ) : stack === 'nodejs' ? (
            <SnippetBlock title="Hook Node" value={buildNodeHookSnippet(ctx)} onCopy={() => copyToClipboard(buildNodeHookSnippet(ctx))} />
          ) : (
            <SnippetBlock title="cURL" value={buildCurlExamples(ctx).create} onCopy={() => copyToClipboard(buildCurlExamples(ctx).create)} />
          )}
        </div>

        {solicitud.status === 'active' && (
          <p className="mt-6 text-sm text-[#6b7280]">
            Accede a la consola con los usuarios creados en la activación:{' '}
            <Link to="/login" className="font-medium text-[#1a3a5c]">/login</Link>
          </p>
        )}
      </div>
    </div>
  )
}

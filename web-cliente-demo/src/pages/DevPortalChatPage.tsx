import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import IntegrationCodePanel from '../components/codegen/IntegrationCodePanel'
import { useDevAuth } from '../context/DevAuthContext'
import type { OnboardingContext } from '../lib/onboardingSnippets'
import {
  draftCanSubmit,
  draftToSolicitudBody,
  getDevChatStatus,
  sendDevChat,
  upsertDevSolicitud,
  type DevChatDraft,
  type DevChatMessage,
} from '../services/devPortalApi'

const WELCOME: DevChatMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy el asistente de integración de Nexum. Te guiaré para registrar tu organización, usuarios de consola y diseño de integración API — sin que toques Hyperledger.\n\n¿Cómo se llama tu empresa?',
}

function draftHasCodegen(draft: DevChatDraft | null): boolean {
  const i = draft?.integration
  return !!(i?.entityType?.trim() && i?.stack && (i?.payloadExample?.trim() || i?.entityName?.trim()))
}

function draftToCodegenCtx(draft: DevChatDraft | null): OnboardingContext | null {
  if (!draftHasCodegen(draft) || !draft?.integration) return null
  const i = draft.integration
  return {
    baseUrl: 'http://localhost:3000',
    apiKey: `${draft.tenantId ?? 'tenant'}-integrador-PENDIENTE`,
    apiKeyRole: 'integrador',
    entityName: i.entityName || 'Registro',
    businessIdField: i.businessIdField || 'id',
    entityType: i.entityType,
    schemaVersion: i.schemaVersion || 'v1',
    payloadExampleText: i.payloadExample || '{}',
    attributes: i.attributes,
  }
}

export default function DevPortalChatPage() {
  const navigate = useNavigate()
  const { estado: devEstado, usuario } = useDevAuth()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [model, setModel] = useState('')
  const [messages, setMessages] = useState<DevChatMessage[]>([WELCOME])
  const [draft, setDraft] = useState<DevChatDraft | null>(null)
  const [ready, setReady] = useState(false)
  const [complete, setComplete] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getDevChatStatus()
      .then((s) => {
        setConfigured(s.configured)
        setModel(s.model)
      })
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    const nextMessages: DevChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await sendDevChat(nextMessages, draft)
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }])
      if (res.draft) setDraft(res.draft)
      setReady(res.ready)
      setComplete(res.complete)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al contactar el asistente')
    } finally {
      setLoading(false)
    }
  }

  const submitFromDraft = async () => {
    if (!draft?.tenantId) return
    if (devEstado !== 'autenticado') {
      navigate('/dev/login', { state: { from: '/dev/asistente' } })
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body = draftToSolicitudBody({
        ...draft,
        contactEmail: usuario?.email ?? draft.contactEmail,
      })
      const solicitud = await upsertDevSolicitud(body)
      navigate(`/dev/estado/${solicitud.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const effectiveDraft = {
    ...draft,
    contactEmail: usuario?.email ?? draft?.contactEmail,
  }
  const canSubmitDraft = draftCanSubmit(effectiveDraft)
  const showSubmit = (ready || complete) && canSubmitDraft
  const codegenCtx = useMemo(() => draftToCodegenCtx(draft), [draft])
  const stack = (draft?.integration?.stack ?? 'laravel') as 'laravel' | 'nodejs' | 'curl'

  const submitHint = complete && !ready
    ? 'Datos completos. Escribe «sí, enviar» en el chat o pulsa el botón.'
    : devEstado !== 'autenticado'
      ? 'Inicia sesión para poder enviar la solicitud.'
      : 'Cuando confirmes todos los datos en el chat, aquí aparecerá el botón de envío.'

  return (
    <div className="container-xl py-4">
      <div className="mb-4">
        <Link to="/dev" className="btn btn-ghost-secondary btn-sm mb-2">
          ← Portal Integrador Nexum
        </Link>
        <h1 className="page-title">Asistente de integración</h1>
        <p className="text-secondary mb-0">
          Opción guiada por IA para estructurar tu payload y generar ejemplos de código Nexum.
        </p>
        {configured === false ? (
          <div className="alert alert-warning mt-3 mb-0">
            IA no configurada en el servidor (DEEPSEEK_API_KEY). Usa el{' '}
            <Link to="/dev/solicitud">formulario manual</Link> para crear tu solicitud.
          </div>
        ) : null}
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">
              <h3 className="card-title">Chat con Nexum</h3>
              <div className="card-subtitle text-secondary">
                {configured === false
                  ? 'Asistente no disponible'
                  : configured
                    ? `Conectado · ${model || 'DeepSeek'}`
                    : 'Comprobando asistente…'}
              </div>
            </div>
            <div className="card-body overflow-auto" style={{ maxHeight: '28rem' }}>
              {messages.map((m, i) => (
                <div key={i} className={`d-flex mb-3 ${m.role === 'user' ? 'justify-content-end' : ''}`}>
                  <div
                    className={`rounded px-3 py-2 small ${
                      m.role === 'user' ? 'bg-primary text-white' : 'bg-light'
                    }`}
                    style={{ maxWidth: '85%', whiteSpace: 'pre-wrap' }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading ? <p className="text-secondary small">El asistente está escribiendo…</p> : null}
              <div ref={bottomRef} />
            </div>
            {error ? <div className="card-footer text-danger small">{error}</div> : null}
            <div className="card-footer">
              <div className="input-group">
                <input
                  className="form-control"
                  placeholder="Escribe tu mensaje…"
                  value={input}
                  disabled={loading || configured === false}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={loading || !input.trim() || configured === false}
                  className="btn btn-warning"
                  onClick={() => void send()}
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Borrador</h3>
            </div>
            <div className="card-body">
              <dl className="row mb-0 small">
                <dt className="col-5 text-secondary">Organización</dt>
                <dd className="col-7">{draft?.orgName || '—'}</dd>
                <dt className="col-5 text-secondary">tenant_id</dt>
                <dd className="col-7 font-monospace">{draft?.tenantId || '—'}</dd>
                <dt className="col-5 text-secondary">Contacto</dt>
                <dd className="col-7">{effectiveDraft.contactEmail || '—'}</dd>
                <dt className="col-5 text-secondary">Integración</dt>
                <dd className="col-7">
                  {draft?.integration?.entityType || '—'} / {draft?.integration?.stack || '—'}
                </dd>
                <dt className="col-5 text-secondary">Usuarios</dt>
                <dd className="col-7">{draft?.users?.length ?? 0}</dd>
              </dl>
              {showSubmit ? (
                <>
                  {devEstado !== 'autenticado' ? (
                    <p className="mt-3 small text-warning">
                      <Link to="/dev/registro">Crea una cuenta</Link> o{' '}
                      <Link to="/dev/login">inicia sesión</Link> para enviar.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={submitting || !canSubmitDraft || devEstado !== 'autenticado'}
                    className="btn btn-primary w-100 mt-3"
                    onClick={() => void submitFromDraft()}
                  >
                    {submitting ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </>
              ) : (
                <p className="mt-3 small text-secondary">{submitHint}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {codegenCtx ? (
        <div className="card mt-4">
          <div className="card-header">
            <h3 className="card-title">Tu código de integración</h3>
            <div className="card-subtitle text-secondary">
              Generado desde tu diseño de payload. Copia el controller a tu proyecto Laravel.
            </div>
          </div>
          <div className="card-body">
            <IntegrationCodePanel
              ctx={codegenCtx}
              stack={stack}
              keysPending
              downloadName={`integracion-${draft?.tenantId ?? 'borrador'}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

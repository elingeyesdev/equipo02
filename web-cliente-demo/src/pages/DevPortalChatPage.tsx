import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconSend } from '@tabler/icons-react'
import IntegrationCodePanel from '../components/codegen/IntegrationCodePanel'
import { ChatMarkdown } from '../components/dev/ChatMarkdown'
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
import '../dev-assistant.css'

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

type DraftStep = { id: string; label: string; done: boolean }

function draftSteps(draft: DevChatDraft | null, ready: boolean, complete: boolean): DraftStep[] {
  const i = draft?.integration
  return [
    { id: 'org', label: 'Organización', done: Boolean(draft?.orgName?.trim() && draft?.tenantId?.trim()) },
    {
      id: 'integration',
      label: 'Datos de integración',
      done: Boolean(i?.entityType?.trim() && i?.stack),
    },
    { id: 'users', label: 'Usuarios', done: Boolean((draft?.users ?? []).some((u) => u.username?.trim())) },
    {
      id: 'payload',
      label: 'Payload',
      done: Boolean(i?.payloadExample?.trim() || i?.entityName?.trim()),
    },
    { id: 'confirm', label: 'Confirmación', done: ready || complete },
  ]
}

function DraftValue({ value, mono = false }: { value?: string | number | null; mono?: boolean }) {
  const empty = value === undefined || value === null || String(value).trim() === ''
  return (
    <span
      className={[
        'dev-assistant-draft-value',
        mono ? 'dev-assistant-draft-value--mono' : '',
        empty ? 'dev-assistant-draft-pending' : '',
      ].join(' ')}
    >
      {empty ? 'Pendiente' : value}
    </span>
  )
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
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void getDevChatStatus()
      .then((s) => {
        setConfigured(s.configured)
        setModel(s.model)
      })
      .catch(() => setConfigured(false))
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const adjustInputHeight = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [])

  useEffect(() => {
    adjustInputHeight()
  }, [input, adjustInputHeight])

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
      setError(e instanceof Error ? e.message : 'No se pudo obtener respuesta. Intenta nuevamente.')
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
  const steps = draftSteps(draft, ready, complete)

  const submitHint = showSubmit
    ? devEstado !== 'autenticado'
      ? 'Inicia sesión para enviar la solicitud.'
      : 'Revisa el borrador y envía cuando estés listo.'
    : complete && !ready
      ? 'Datos completos. Escribe «sí, enviar» en el chat o completa la confirmación.'
      : 'Completa la conversación para habilitar el envío.'

  const statusTitle =
    configured && model ? `Modelo: ${model}` : configured ? 'Asistente conectado' : undefined

  return (
    <div className="container-xl py-4 dev-assistant-page">
      <header className="dev-assistant-header">
        <Link to="/dev" className="dev-assistant-back">
          ← Portal Integrador Nexum
        </Link>
        <h1 className="dev-assistant-title">Asistente de integración</h1>
        <p className="dev-assistant-lead">
          Te guiamos para estructurar tu payload, definir usuarios y preparar tu solicitud de integración.
        </p>
        {configured === false ? (
          <div className="dev-assistant-warn" role="alert">
            IA no configurada en el servidor (DEEPSEEK_API_KEY). Usa el{' '}
            <Link to="/dev/solicitud">formulario manual</Link> para crear tu solicitud.
          </div>
        ) : null}
      </header>

      <div className="dev-assistant-layout">
        <div className="dev-assistant-chat-col">
          <div className="dev-assistant-chat-card">
            <div className="dev-assistant-chat-header">
              <div>
                <h2 className="dev-assistant-chat-title">Chat con Nexum</h2>
                <p className="dev-assistant-chat-sub">Asistente de integración</p>
              </div>
              <div className="dev-assistant-chat-meta">
                <span
                  className={`dev-assistant-status${configured ? '' : ' dev-assistant-status--off'}`}
                  title={statusTitle}
                >
                  <span className="dev-assistant-status-dot" aria-hidden />
                  {configured === false
                    ? 'No disponible'
                    : configured
                      ? 'Conectado'
                      : 'Comprobando…'}
                </span>
              </div>
            </div>

            <div className="dev-assistant-messages" ref={messagesRef} aria-live="polite">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`dev-assistant-msg ${m.role === 'user' ? 'dev-assistant-msg--user' : 'dev-assistant-msg--bot'}`}
                >
                  {m.role === 'assistant' ? (
                    <span className="dev-assistant-msg-avatar" aria-hidden>
                      N
                    </span>
                  ) : null}
                  <div className="dev-assistant-msg-bubble">
                    {m.role === 'assistant' ? <ChatMarkdown content={m.content} /> : m.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="dev-assistant-typing" aria-busy="true">
                  <span className="dev-assistant-typing-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  Nexum está preparando la respuesta…
                </div>
              ) : null}
            </div>

            {error ? <div className="dev-assistant-chat-error" role="alert">{error}</div> : null}

            <div className="dev-assistant-composer">
              <textarea
                ref={inputRef}
                className="dev-assistant-input"
                rows={1}
                placeholder="Escribe tu respuesta o describe tu integración…"
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
                className="dev-assistant-send"
                onClick={() => void send()}
              >
                <IconSend size={16} stroke={1.75} aria-hidden />
                Enviar
              </button>
            </div>
          </div>
        </div>

        <aside className="dev-assistant-draft-col">
          <div className="dev-assistant-draft-card">
            <div className="dev-assistant-draft-head">
              <h2 className="dev-assistant-draft-title">Borrador de solicitud</h2>
              <p className="dev-assistant-draft-sub">Resumen generado a partir de la conversación.</p>
            </div>
            <div className="dev-assistant-draft-body">
              <ul className="dev-assistant-checklist" aria-label="Progreso del borrador">
                {steps.map((step) => (
                  <li key={step.id} className={step.done ? 'is-done' : undefined}>
                    <span className="dev-assistant-check-icon" aria-hidden>
                      {step.done ? '✓' : ''}
                    </span>
                    {step.label}
                  </li>
                ))}
              </ul>

              <div className="dev-assistant-draft-rows">
                <div className="dev-assistant-draft-row">
                  <span className="dev-assistant-draft-label">Organización</span>
                  <DraftValue value={draft?.orgName} />
                </div>
                <div className="dev-assistant-draft-row">
                  <span className="dev-assistant-draft-label">tenant_id</span>
                  <DraftValue value={draft?.tenantId} mono />
                </div>
                <div className="dev-assistant-draft-row">
                  <span className="dev-assistant-draft-label">Contacto</span>
                  <DraftValue value={effectiveDraft.contactEmail} />
                </div>
                <div className="dev-assistant-draft-row">
                  <span className="dev-assistant-draft-label">Integración</span>
                  <DraftValue
                    value={
                      draft?.integration?.entityType
                        ? `${draft.integration.entityType} / ${draft.integration.stack ?? '—'}`
                        : undefined
                    }
                  />
                </div>
                <div className="dev-assistant-draft-row">
                  <span className="dev-assistant-draft-label">Usuarios</span>
                  <DraftValue value={draft?.users?.length ? String(draft.users.length) : undefined} />
                </div>
              </div>

              <p className="dev-assistant-draft-foot">
                Cuando completes los datos requeridos, podrás enviar la solicitud para revisión.
              </p>

              {showSubmit ? (
                <>
                  {devEstado !== 'autenticado' ? (
                    <p className="dev-assistant-submit-hint mb-2">
                      <Link to="/dev/registro">Crea una cuenta</Link> o{' '}
                      <Link to="/dev/login">inicia sesión</Link> para enviar.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={submitting || !canSubmitDraft || devEstado !== 'autenticado'}
                    className="dev-assistant-submit"
                    onClick={() => void submitFromDraft()}
                  >
                    {submitting ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </>
              ) : (
                <p className="dev-assistant-submit-hint">{submitHint}</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {codegenCtx ? (
        <section className="dev-assistant-codegen">
          <div className="dev-assistant-codegen-head">
            <h2 className="dev-assistant-codegen-title">Tu código de integración</h2>
            <p className="dev-assistant-codegen-sub">
              Generado desde tu diseño de payload. Copia el controller a tu proyecto.
            </p>
          </div>
          <div className="dev-assistant-codegen-body">
            <IntegrationCodePanel
              ctx={codegenCtx}
              stack={stack}
              keysPending
              downloadName={`integracion-${draft?.tenantId ?? 'borrador'}`}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}

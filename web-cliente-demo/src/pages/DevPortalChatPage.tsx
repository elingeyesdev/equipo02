import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { inputClass } from '../components/onboarding/OnboardingUi'
import {
  draftCanSubmit,
  draftToSolicitudBody,
  getDevChatStatus,
  sendDevChat,
  upsertDevSolicitud,
  type DevChatDraft,
  type DevChatMessage,
} from '../services/devPortalApi'
import DevPortalFormWizard from './DevPortalFormWizard'
import { useDevAuth } from '../context/DevAuthContext'

const WELCOME: DevChatMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy el asistente de alta en Nexum BaaS. Te guiaré para registrar tu organización, usuarios de consola y diseño de integración API — sin que toques Hyperledger.\n\n¿Cómo se llama tu empresa?',
}

export default function DevPortalChatPage() {
  const navigate = useNavigate()
  const { estado: devEstado, usuario } = useDevAuth()
  const [mode, setMode] = useState<'chat' | 'form'>('chat')
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
      navigate('/dev/login', { state: { from: '/dev' } })
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

  const canSubmitDraft = draftCanSubmit({
    ...draft,
    contactEmail: usuario?.email ?? draft?.contactEmail,
  })
  const showSubmit = (ready || complete) && canSubmitDraft
  const submitHint = complete && !ready
    ? 'Datos completos. Escribe «sí, enviar» en el chat o pulsa el botón.'
    : devEstado !== 'autenticado'
      ? 'Inicia sesión para poder enviar la solicitud.'
      : 'Cuando confirmes todos los datos en el chat, aquí aparecerá el botón de envío.'

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb] flex flex-col">
      <header className="border-b border-line/60 bg-white/90 backdrop-blur-sm shrink-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="text-sm font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">
            Nexum Dev Portal
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex rounded-full border border-line/60 p-0.5 text-xs font-semibold">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 ${mode === 'chat' ? 'bg-[#1a3a5c] text-white' : 'text-[#6b7280]'}`}
                onClick={() => setMode('chat')}
              >
                Chat IA
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 ${mode === 'form' ? 'bg-[#1a3a5c] text-white' : 'text-[#6b7280]'}`}
                onClick={() => setMode('form')}
              >
                Formulario
              </button>
            </div>
            <Link to="/dev/mis-solicitudes" className="text-sm font-medium text-[#6b7280] hover:text-[#1a3a5c]">
              Mis solicitudes
            </Link>
            {devEstado === 'autenticado' ? (
              <span className="text-xs text-[#6b7280]">{usuario?.email}</span>
            ) : (
              <Link to="/dev/login" className="text-sm font-medium text-[#1a3a5c]">
                Entrar
              </Link>
            )}
            <Link to="/admin/solicitudes" className="text-sm font-medium text-[#6b7280] hover:text-[#1a3a5c]">
              Operador
            </Link>
          </div>
        </div>
      </header>

      {mode === 'form' ? (
        <DevPortalFormWizard />
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-8 lg:flex-row lg:items-stretch">
          <section className="flex min-h-[420px] flex-1 flex-col rounded-3xl border border-line/60 bg-white shadow-sm">
            <div className="border-b border-line/40 px-5 py-4">
              <h1 className="text-lg font-bold text-[#1a2332]">Asistente de alta BaaS</h1>
              <p className="text-xs text-[#6b7280]">
                {configured === false
                  ? 'IA no configurada en el BFF (DEEPSEEK_API_KEY). Usa el formulario manual.'
                  : configured
                    ? `Conectado · ${model || 'DeepSeek'}`
                    : 'Comprobando asistente…'}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#1a3a5c] text-white'
                        : 'bg-[#f4f7fb] text-[#1a2332]'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <p className="text-xs text-[#6b7280] animate-pulse">El asistente está escribiendo…</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {error ? <p className="px-5 text-sm text-red-600">{error}</p> : null}

            <div className="border-t border-line/40 p-4">
              <div className="flex gap-2">
                <input
                  className={inputClass}
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
                  className="shrink-0 rounded-full bg-[#f0b429] px-5 py-2 text-sm font-bold text-[#1a2332] disabled:opacity-40"
                  onClick={() => void send()}
                >
                  Enviar
                </button>
              </div>
            </div>
          </section>

          <aside className="w-full shrink-0 rounded-3xl border border-line/60 bg-white p-5 shadow-sm lg:w-80">
            <h2 className="text-sm font-bold text-[#1a2332]">Borrador</h2>
            <dl className="mt-4 space-y-2 text-xs">
              <div>
                <dt className="text-[#6b7280]">Organización</dt>
                <dd className="font-medium">{draft?.orgName || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#6b7280]">tenant_id</dt>
                <dd className="font-mono">{draft?.tenantId || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#6b7280]">Contacto</dt>
                <dd>{draft?.contactEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#6b7280]">Integración</dt>
                <dd>{draft?.integration?.entityType || '—'} / {draft?.integration?.stack || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#6b7280]">Usuarios</dt>
                <dd>{draft?.users?.length ?? 0}</dd>
              </div>
            </dl>

            {showSubmit ? (
              <>
                {devEstado !== 'autenticado' ? (
                  <p className="mt-4 text-xs text-amber-800">
                    <Link to="/dev/registro" className="font-semibold underline">Crea una cuenta</Link>
                    {' '}o{' '}
                    <Link to="/dev/login" className="font-semibold underline">inicia sesión</Link>
                    {' '}para enviar.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={submitting || !canSubmitDraft || devEstado !== 'autenticado'}
                  className="mt-4 w-full rounded-full bg-[#1a3a5c] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void submitFromDraft()}
                >
                  {submitting ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </>
            ) : (
              <p className="mt-6 text-xs text-[#6b7280]">{submitHint}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

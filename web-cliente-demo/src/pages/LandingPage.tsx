import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Layers, Link2, Network, Rocket, ScrollText } from 'lucide-react'

const STATS = [
  { valor: 'API', etiqueta: 'REST universal para cualquier empresa' },
  { valor: 'Fabric', etiqueta: 'Red Hyperledger segura y siempre disponible' },
  { valor: 'Multi', etiqueta: 'Tenant aislado por organización' },
] as const

const SERVICIOS = [
  {
    titulo: 'Portal integrador',
    texto: 'Alta con asistente IA, código Laravel generado y seguimiento de tu solicitud BaaS.',
    icon: Rocket,
  },
  {
    titulo: 'Middleware',
    texto: 'Validación, auditoría y traducción de operaciones hacia el ledger.',
    icon: Layers,
  },
  {
    titulo: 'Auditoría',
    texto: 'Historial, trazabilidad y consulta de eventos en solo lectura.',
    icon: ScrollText,
  },
  {
    titulo: 'Integración',
    texto: 'Cualquier sistema empresarial se conecta sin tocar la red directamente.',
    icon: Network,
  },
] as const

const BENEFICIOS = [
  'Tu organización opera con su propio espacio y permisos',
  'Cada registro queda guardado de forma segura e inmutable en la red',
  'Accede a tu panel privado para consultar historial y trazabilidad',
] as const

const ACCESOS = [
  {
    titulo: 'Portal Integrador',
    descripcion: 'Solicita alta, diseña tu integración y descarga el código.',
    to: '/dev/login',
  },
  {
    titulo: 'Consola Operador',
    descripcion: 'Gestiona solicitudes y activa tenants en el BaaS.',
    to: '/admin/solicitudes',
  },
  {
    titulo: 'Consola Cliente',
    descripcion: 'Panel de tu organización: datos, auditoría y aprobaciones.',
    to: '/login',
  },
] as const

function AccederMenu({
  variant = 'dark',
  className = '',
}: {
  variant?: 'dark' | 'light' | 'outline'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const btnClass =
    variant === 'dark'
      ? 'rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20'
      : variant === 'outline'
        ? 'inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10'
        : 'inline-flex items-center justify-center rounded-full border border-[#1a3a5c]/20 bg-white px-7 py-3.5 text-sm font-semibold text-[#1a3a5c] transition-colors hover:bg-[#f4f7fb]'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" className={btnClass} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Acceder
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[#e8edf3] bg-white shadow-xl"
          role="menu"
        >
          {ACCESOS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              role="menuitem"
              className="block border-b border-[#f0f2f5] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#f8fafc]"
              onClick={() => setOpen(false)}
            >
              <p className="text-sm font-semibold text-[#1a2332]">{a.titulo}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#6b7280]">{a.descripcion}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="landing-page min-h-[100dvh] bg-[#f4f7fb] text-[#1a2332]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold uppercase tracking-[0.08em] text-white sm:text-3xl">Nexum</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 md:flex">
            <a href="#inicio" className="transition-colors hover:text-[#f0b429]">
              Inicio
            </a>
            <a href="#servicios" className="transition-colors hover:text-[#f0b429]">
              Servicios
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-[#f0b429]">
              Cómo funciona
            </a>
          </nav>
          <AccederMenu variant="dark" />
        </div>
      </header>

      <section id="inicio" className="landing-hero relative overflow-hidden pt-24 pb-0 sm:pt-28">
        <div className="landing-blob pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full opacity-80" aria-hidden />
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-14 lg:pb-20">
          <div className="relative z-10">
            <p className="text-sm font-medium text-[#f0b429]">Plataforma BaaS · Puente universal</p>
            <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl">
              Tu empresa conectada a{' '}
              <span className="landing-highlight">blockchain</span> sin complejidad técnica
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/72">
              Nexum es el puente entre los sistemas de cada organización y Hyperledger Fabric. Registra,
              audita y consulta operaciones desde un solo punto de acceso.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/dev/registro"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f0b429] px-7 py-3.5 text-sm font-bold text-[#1a2332] shadow-lg shadow-[#f0b429]/25 transition-transform hover:scale-[1.02] hover:bg-[#f5c24a]"
              >
                Solicitar integración
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </Link>
              <AccederMenu variant="outline" />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none lg:justify-self-end">
            <HeroVisual />
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.04] backdrop-blur-sm">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-3 sm:px-8">
            {STATS.map((s) => (
              <div key={s.valor} className="flex items-start gap-4">
                <span className="text-3xl font-bold text-[#f0b429]">{s.valor}</span>
                <p className="pt-1 text-sm leading-snug text-white/65">{s.etiqueta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#dce6f2] p-2 sm:p-3">
            <div className="overflow-hidden rounded-[1.6rem] bg-[#c5d4e8]">
              <FlowDiagram />
            </div>
            <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-[#f0b429]/30 blur-2xl" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#c48f12]">Integración empresarial</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-[#1a2332] sm:text-4xl">
              Un puente que tu equipo{' '}
              <span className="text-[#1a3a5c]">entiende y usa con confianza</span>
            </h2>
            <ul className="mt-8 space-y-4">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex gap-3 text-sm leading-relaxed text-[#4a5568]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0b429] text-[#1a2332]">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/dev"
                className="inline-flex items-center justify-center rounded-full bg-[#1a3a5c] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f2844]"
              >
                Empezar con el asistente
              </Link>
              <span className="text-sm text-[#6b7280]">· Chat IA + código listo para tu backend</span>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-[#1a2332] sm:text-4xl">
              Todo lo que necesitas para{' '}
              <span className="landing-highlight">conectar</span> tu organización
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
              Desde el alta en el portal integrador hasta la auditoría en red: un flujo claro para tu organización.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map((s) => (
              <article
                key={s.titulo}
                className="rounded-2xl border border-[#e8edf3] bg-[#fafbfd] p-6 transition-shadow hover:shadow-lg hover:shadow-[#1a3a5c]/6"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a3a5c] text-[#f0b429]">
                  <s.icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 text-base font-bold text-[#1a2332]">{s.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{s.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="rounded-3xl bg-[#1a3a5c] px-6 py-10 text-center sm:px-10 sm:py-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">¿Listo para empezar?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/70">
            Crea tu cuenta en el portal integrador, diseña la conexión con el asistente y recibe credenciales
            cuando el operador active tu tenant.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/dev/registro"
              className="inline-flex items-center justify-center rounded-full bg-[#f0b429] px-8 py-3.5 text-sm font-bold text-[#1a2332] transition-colors hover:bg-[#f5c24a]"
            >
              Solicitar integración
            </Link>
            <AccederMenu variant="outline" />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e8edf3] bg-white py-5 text-center text-xs text-[#9ca3af]">
        Nexum · Middleware blockchain sobre Hyperledger Fabric
      </footer>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="relative aspect-[4/5] w-full max-w-sm sm:max-w-md lg:ml-auto lg:max-w-lg">
      <div className="absolute bottom-6 left-8 right-4 rounded-2xl border-4 border-white/10 bg-white p-4 shadow-2xl sm:bottom-10 sm:left-12">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a3a5c]">
            <Link2 className="h-5 w-5 text-[#f0b429]" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-xs font-bold text-[#1a2332]">Puente Nexum</p>
            <p className="text-[11px] text-[#6b7280]">Validación · Auditoría · Envío</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-[#6b7280]">Conexión activa con Fabric</span>
        </div>
      </div>

      <div
        className="absolute bottom-24 right-2 h-20 w-20 rounded-full bg-[#f0b429]/90 shadow-lg sm:bottom-28"
        aria-hidden
      />
    </div>
  )
}

function FlowDiagram() {
  const pasos = [
    { label: 'Sistema de la empresa', sub: 'Portal, ERP o app propia' },
    { label: 'Puente Nexum', sub: 'Middleware y API REST' },
    { label: 'Hyperledger Fabric', sub: 'Registro inmutable en red' },
  ]

  return (
    <div className="bg-gradient-to-br from-[#b8c9de] to-[#9eb3cc] px-6 py-10 sm:px-10 sm:py-12">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-[#1a3a5c]/80">
        Flujo de una operación
      </p>
      <div className="mt-8 space-y-4">
        {pasos.map((p, i) => (
          <div key={p.label} className="relative">
            <div className="flex items-center gap-4 rounded-2xl bg-white/90 px-5 py-4 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a3a5c] text-sm font-bold text-[#f0b429]">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-[#1a2332]">{p.label}</p>
                <p className="text-xs text-[#6b7280]">{p.sub}</p>
              </div>
            </div>
            {i < pasos.length - 1 ? (
              <div className="ml-[1.375rem] h-4 w-px bg-[#1a3a5c]/25" aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

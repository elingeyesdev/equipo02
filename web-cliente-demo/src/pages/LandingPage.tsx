import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconApi,
  IconChevronRight,
  IconBuilding,
  IconCalendar,
  IconCode,
  IconCube,
  IconLayoutDashboard,
  IconPackage,
  IconPlugConnected,
  IconSearch,
  IconServer2,
  IconKey,
  IconLock,
  IconNetwork,
  IconShield,
  IconShieldCheck,
  IconTimeline,
  IconUsers,
} from '@tabler/icons-react'

const LOGO_BLANCO = '/logoNexumBlanco.png'
const IMG_HERO = '/landing/hero.png'
const IMG_SOLVE = '/landing/panel.png'
const IMG_CTA_BG = '/landing/cta-bg.png'
const IMG_PREVIEW_DEV = '/landing/portalintegrador.png'
const IMG_PREVIEW_APP = '/landing/portalcliente.png'

const HERO_STATS = [
  { label: 'Tenant activo', value: '12', icon: IconBuilding },
  { label: 'Evidencia registrada', value: '24.861', icon: IconShieldCheck },
  { label: 'Ledger confirmado', value: '100%', icon: IconNetwork },
] as const

const CONFIANZA = [
  { label: 'Integración vía API', icon: IconApi },
  { label: 'Evidencia inmutable', icon: IconShield },
  { label: 'Consolas por rol', icon: IconUsers },
  { label: 'Hyperledger Fabric permissionado', icon: IconNetwork },
] as const

const QUE_RESUELVE = [
  {
    titulo: 'Cambios difíciles de comprobar',
    texto: 'Las modificaciones en sistemas internos no siempre dejan un registro independiente.',
    icon: IconSearch,
  },
  {
    titulo: 'Historial disperso',
    texto: 'Logs locales y exportaciones no bastan para reconstruir qué ocurrió con un dato.',
    icon: IconServer2,
  },
  {
    titulo: 'Auditoría sin flujo estandarizado',
    texto: 'Cada integración define su propia forma de registrar evidencia.',
    icon: IconCalendar,
  },
] as const

const PASOS = [
  {
    paso: 1,
    titulo: 'Solicitud de integración',
    icon: IconPackage,
  },
  {
    paso: 2,
    titulo: 'Provisionamiento del tenant',
    icon: IconServer2,
  },
  {
    paso: 3,
    titulo: 'Registro de eventos por API',
    icon: IconCode,
  },
  {
    paso: 4,
    titulo: 'Validación en cadena',
    icon: IconCube,
  },
  {
    paso: 5,
    titulo: 'Consulta y auditoría',
    icon: IconSearch,
  },
] as const

const CODE_SNIPPET = {
  method: 'POST /api/evidence',
  body: `{
  "tenant": "cliente-bank",
  "event": "contract.updated",
  "hash": "0x9fa2...",
  "status": "confirmed"
}`,
}

const ACCESOS = [
  {
    titulo: 'Portal Integrador',
    descripcion: 'Solicitud, seguimiento y credenciales',
    cta: 'Ingresar al portal',
    to: '/dev',
    preview: IMG_PREVIEW_DEV,
    icon: IconPlugConnected,
  },
  {
    titulo: 'Consola Cliente',
    descripcion: 'Evidencias registradas, auditoría e historial',
    cta: 'Ingresar a la consola',
    to: '/login',
    preview: IMG_PREVIEW_APP,
    icon: IconLayoutDashboard,
  },
] as const

const SEGURIDAD = [
  { titulo: 'API keys por rol', texto: 'Integrador, administrador y lectura con permisos diferenciados.', icon: IconKey },
  { titulo: 'Aislamiento por tenant', texto: 'Cada organización opera en su propio espacio de datos.', icon: IconLock },
  { titulo: 'Evidencia inmutable', texto: 'Los registros en cadena no se reescriben; las correcciones generan nueva evidencia.', icon: IconShield },
  { titulo: 'Auditoría de operaciones', texto: 'Eventos y cambios quedan trazables para revisión posterior.', icon: IconTimeline },
  { titulo: 'Ledger privado', texto: 'Hyperledger Fabric permissionado, sin exposición pública del ledger.', icon: IconCube },
  { titulo: 'Permisos diferenciados', texto: 'Cada rol accede solo a las operaciones que le corresponden.', icon: IconUsers },
] as const

function NexumLogo({ height = 36, className = '' }: { height?: number; className?: string }) {
  return (
    <img
      src={LOGO_BLANCO}
      alt="Nexum"
      height={height}
      className={`d-block ${className}`}
      style={{ width: 'auto', height: `${height}px` }}
    />
  )
}

function LandingImage({
  src,
  fallback,
  alt,
  className = '',
}: {
  src: string
  fallback?: string
  alt: string
  className?: string
}) {
  const [current, setCurrent] = useState(src)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <div className={`landing-img-placeholder ${className}`} aria-hidden={!alt} role={alt ? 'img' : undefined} aria-label={alt || undefined} />
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback)
        else setFailed(true)
      }}
    />
  )
}

function cerrarNav(setNavAbierto: (v: boolean) => void) {
  setNavAbierto(false)
}

function LandingCtaBackground() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <img
      src={IMG_CTA_BG}
      alt=""
      className="landing-cta-bg"
      loading="lazy"
      onError={() => setVisible(false)}
    />
  )
}

export default function LandingPage() {
  const [navAbierto, setNavAbierto] = useState(false)

  return (
    <div className="landing-marketing">
      <header className="navbar navbar-expand-lg landing-nav-light d-print-none">
        <div className="container-xl">
          <Link to="/" className="navbar-brand landing-brand-light">
            <NexumLogo height={38} className="landing-brand-logo" />
          </Link>
          <button
            type="button"
            className="navbar-toggler"
            aria-controls="landing-nav"
            aria-expanded={navAbierto}
            aria-label="Abrir navegación"
            onClick={() => setNavAbierto((v) => !v)}
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className={`collapse navbar-collapse landing-nav-collapse${navAbierto ? ' show' : ''}`} id="landing-nav">
            <ul className="navbar-nav mx-auto landing-nav-links">
              <li className="nav-item">
                <a className="nav-link" href="#solucion" onClick={() => cerrarNav(setNavAbierto)}>
                  Solución
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#como-funciona" onClick={() => cerrarNav(setNavAbierto)}>
                  Cómo funciona
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#seguridad" onClick={() => cerrarNav(setNavAbierto)}>
                  Seguridad
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#accesos" onClick={() => cerrarNav(setNavAbierto)}>
                  Accesos
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#footer-contacto" onClick={() => cerrarNav(setNavAbierto)}>
                  Contacto
                </a>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <section id="inicio" className="landing-hero-light">
        <div className="container-xl">
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-lg-6">
              <p className="landing-hero-eyebrow-light mb-3">Blockchain-as-a-Service</p>
              <h1 className="landing-hero-title-light mb-3">
                <span className="landing-hero-title-line">
                  Evidencia{' '}
                  <span className="landing-hero-accent-light">verificable</span>
                </span>
                <span className="landing-hero-title-line landing-hero-title-sub-light">para sistemas críticos</span>
              </h1>
              <p className="landing-hero-lead-light mb-4">
                Nexum registra eventos y cambios sensibles mediante API, generando trazabilidad consultable sobre
                Hyperledger Fabric sin reemplazar tu sistema actual.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link to="/dev" className="btn btn-landing-primary btn-lg">
                  Solicitar integración
                </Link>
                <a href="#accesos" className="btn btn-outline-primary btn-lg">
                  Ver accesos
                </a>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="landing-hero-visual-wrap">
                <img
                  src={IMG_HERO}
                  alt="Integración API y evidencia en blockchain"
                  className="landing-hero-illustration"
                  loading="eager"
                  decoding="async"
                />
                <div className="landing-hero-stats">
                  {HERO_STATS.map((s) => (
                    <div key={s.label} className="card landing-hero-stat-card shadow-sm">
                      <div className="card-body d-flex align-items-center gap-3 py-3 px-3">
                        <span className="avatar avatar-sm bg-landing-soft text-landing-action flex-shrink-0">
                          <s.icon size={18} stroke={1.75} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-secondary small mb-0">{s.label}</p>
                          <p className="mb-0 fw-bold text-body">{s.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-xl landing-trust-wrap-light">
        <div className="card landing-trust-band shadow-sm">
          <div className="card-body landing-trust-band-body">
            <div className="row g-3 g-md-0">
              {CONFIANZA.map((item, i) => (
                <div key={item.label} className="col-6 col-md-3">
                  <div className={`landing-trust-item h-100${i < CONFIANZA.length - 1 ? ' landing-trust-divider' : ''}`}>
                    <span className="landing-trust-icon flex-shrink-0">
                      <item.icon size={38} stroke={1.35} />
                    </span>
                    <span className="landing-trust-label">{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section id="solucion" className="landing-section">
        <div className="container-xl">
          <div className="row g-4 g-lg-5 align-items-center">
            <div className="col-lg-6">
              <LandingImage
                src={IMG_SOLVE}
                alt="Panel de evidencia y auditoría Nexum"
                className="landing-photo landing-solve-img"
              />
            </div>
            <div className="col-lg-6">
              <h2 className="h2 landing-section-title mb-3">Qué resuelve Nexum</h2>
              <p className="text-secondary mb-4">
                Nexum agrega una capa de evidencia blockchain sin reemplazar la base de datos del cliente. El sistema de
                origen sigue operando; Nexum registra lo que debe poder auditarse después.
              </p>
              <div className="row g-3">
                {QUE_RESUELVE.map((item) => (
                  <div key={item.titulo} className="col-md-4">
                    <div className="card h-100 landing-solve-card">
                      <div className="card-body p-3 p-lg-4">
                        <span className="avatar avatar-sm bg-landing-soft text-landing-action flex-shrink-0 mb-3">
                          <item.icon size={18} stroke={1.75} />
                        </span>
                        <h3 className="h5 mb-2">{item.titulo}</h3>
                        <p className="text-secondary small mb-0">{item.texto}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="landing-section landing-section-alt">
        <div className="container-xl">
          <div className="page-header mb-4 mb-lg-5">
            <h2 className="page-title landing-section-title">Cómo funciona</h2>
            <p className="text-secondary mb-0">Del alta del integrador a la evidencia consultable en consola.</p>
          </div>
          <div className="row g-4 g-xl-5 align-items-center">
            <div className="col-xl-7">
              <div className="landing-flow-track" aria-label="Flujo de integración Nexum">
                {PASOS.map((p, i) => (
                  <div key={p.paso} className="landing-flow-step-v2">
                    <div className="landing-flow-step-top">
                      <span className="landing-flow-number-v2">{p.paso}</span>
                      {i < PASOS.length - 1 ? <span className="landing-flow-connector" aria-hidden /> : null}
                    </div>
                    <span className="landing-flow-icon-v2">
                      <p.icon size={22} stroke={1.5} />
                    </span>
                    <p className="landing-flow-label-v2">{p.titulo}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-xl-5">
              <div className="landing-code-panel-v2">
                <p className="landing-code-panel-title">Ejemplo de petición API</p>
                <div className="landing-code-body">
                  <p className="landing-code-method">{CODE_SNIPPET.method}</p>
                  <pre className="landing-code-json mb-0">{CODE_SNIPPET.body}</pre>
                </div>
                <div className="landing-code-status">
                  <span className="landing-code-status-dot" aria-hidden />
                  200 OK
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="accesos" className="landing-section">
        <div className="container-xl">
          <div className="page-header mb-4 mb-lg-5">
            <h2 className="page-title landing-section-title">Accesos del sistema</h2>
            <p className="text-secondary mb-0">Dos interfaces según el rol: integración y tenant cliente.</p>
          </div>
          <div className="row g-4 justify-content-center">
            {ACCESOS.map((a) => (
              <div key={a.titulo} className="col-md-11 col-lg-5 col-xl-5">
                <article className="card landing-access-card-v2 h-100">
                  <div className="landing-access-card-head">
                    <span className="landing-access-card-icon">
                      <a.icon size={24} stroke={1.6} />
                    </span>
                    <div>
                      <h3 className="landing-access-card-title">{a.titulo}</h3>
                      <p className="landing-access-card-subtitle mb-0">{a.descripcion}</p>
                    </div>
                  </div>
                  <LandingImage
                    src={a.preview}
                    alt={`Vista previa ${a.titulo}`}
                    className="landing-access-preview-v2"
                  />
                  <div className="landing-access-card-foot">
                    <Link to={a.to} className="landing-access-link">
                      {a.cta}
                      <IconChevronRight size={18} stroke={1.75} aria-hidden />
                    </Link>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="seguridad" className="landing-section landing-section-alt">
        <div className="container-xl">
          <div className="page-header mb-4 mb-lg-5">
            <h2 className="page-title landing-section-title">Diseñado para entornos permissionados</h2>
            <p className="text-secondary mb-0">Controles para operación B2B con identidad por rol y evidencia verificable.</p>
          </div>
          <div className="row g-3">
            {SEGURIDAD.map((s) => (
              <div key={s.titulo} className="col-md-6 col-lg-4">
                <div className="card card-sm h-100 landing-security-card">
                  <div className="card-body d-flex gap-3">
                    <span className="avatar avatar-sm bg-landing-soft text-landing-action flex-shrink-0">
                      <s.icon size={18} stroke={1.75} />
                    </span>
                    <div>
                      <h3 className="h6 mb-1">{s.titulo}</h3>
                      <p className="text-secondary small mb-0">{s.texto}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <LandingCtaBackground />
        <div className="landing-cta-overlay" aria-hidden />
        <div className="container-xl position-relative py-5 py-lg-6 text-center">
          <h2 className="h2 text-white mb-3">
            Integra evidencia <span className="landing-hero-accent-cta">verificable</span> en tu operación actual
          </h2>
          <p className="text-white opacity-75 mx-auto mb-4" style={{ maxWidth: '32rem' }}>
            Solicita una integración y recibe las credenciales necesarias para registrar evidencia desde tu backend.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <Link to="/dev" className="btn btn-light btn-lg">
              Solicitar integración
            </Link>
            <Link to="/dev/login" className="btn btn-landing-outline-light btn-lg">
              Ingresar al Portal Integrador
            </Link>
          </div>
        </div>
      </section>

      <footer id="footer-contacto" className="landing-footer-dark">
        <div className="container-xl py-5">
          <div className="row g-4 align-items-start">
            <div className="col-md-4">
              <span className="landing-brand-badge d-inline-block mb-3">
                <NexumLogo height={32} />
              </span>
              <p className="text-white opacity-50 small mb-0">Universal Blockchain API · BaaS</p>
            </div>
            <div className="col-md-4">
              <p className="text-white opacity-75 small fw-semibold mb-2">Navegación</p>
              <nav className="d-flex flex-column gap-2">
                <a href="#solucion" className="landing-footer-link-dark small">
                  Solución
                </a>
                <a href="#como-funciona" className="landing-footer-link-dark small">
                  Cómo funciona
                </a>
                <a href="#accesos" className="landing-footer-link-dark small">
                  Accesos
                </a>
                <Link to="/dev" className="landing-footer-link-dark small">
                  Solicitar integración
                </Link>
              </nav>
            </div>
            <div className="col-md-4">
              <p className="text-white opacity-75 small fw-semibold mb-2">Consolas</p>
              <nav className="d-flex flex-column gap-2">
                <Link to="/dev/login" className="landing-footer-link-dark small">
                  Portal Integrador
                </Link>
                <Link to="/login" className="landing-footer-link-dark small">
                  Consola Cliente
                </Link>
              </nav>
            </div>
          </div>
          <div className="border-top border-white border-opacity-10 mt-4 pt-4 text-center">
            <p className="text-white opacity-40 small mb-0">
              Nexum · Evidencia consultable · Tenants aislados · Operación permissionada
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

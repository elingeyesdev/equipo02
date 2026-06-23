import { Link } from 'react-router-dom'
import {
  IconBooks,
  IconChevronRight,
  IconClipboardPlus,
  IconFolders,
  IconMessageChatbot,
} from '@tabler/icons-react'
import { useDevAuth } from '../context/DevAuthContext'

const ACCIONES = [
  {
    titulo: 'Nueva solicitud de integración',
    descripcion: 'Registra tu organización, define el tenant y describe qué datos enviarás a blockchain.',
    cta: 'Crear solicitud',
    to: '/dev/solicitud',
    icon: IconClipboardPlus,
    primary: true,
  },
  {
    titulo: 'Asistente de integración',
    descripcion: 'Estructura el payload, define atributos y genera ejemplos listos para tu backend.',
    cta: 'Abrir asistente',
    to: '/dev/asistente',
    icon: IconMessageChatbot,
    primary: false,
  },
  {
    titulo: 'Mis solicitudes',
    descripcion: 'Consulta el estado de tus solicitudes y revisa si el tenant ya fue activado.',
    cta: 'Ver solicitudes',
    to: '/dev/mis-solicitudes',
    icon: IconFolders,
    primary: false,
  },
  {
    titulo: 'Documentación rápida',
    descripcion: 'Conecta tu backend con Laravel, Node.js o cURL usando la API blockchain de Nexum.',
    cta: null,
    to: null,
    icon: IconBooks,
    primary: false,
    docs: true,
  },
] as const

const FLUJO = [
  { paso: 1, titulo: 'Registro del integrador' },
  { paso: 2, titulo: 'Solicitud de tenant' },
  { paso: 3, titulo: 'Revisión del operador' },
  { paso: 4, titulo: 'Provisioning' },
  { paso: 5, titulo: 'Credenciales activas' },
  { paso: 6, titulo: 'Integración con backend' },
] as const

export default function DevPortalDashboardPage() {
  const { estado, usuario } = useDevAuth()

  return (
    <div className="dev-dashboard">
      <section className="dev-dashboard-hero">
        <div className="container-xl">
          <p className="dev-dashboard-eyebrow mb-2">Portal Integrador · BaaS</p>
          <h1 className="dev-dashboard-title mb-2">Gestiona tu integración con Nexum</h1>
          <p className="dev-dashboard-lead mb-0">
            Solicita el alta de tu tenant, sigue el proceso con el operador y obtén credenciales para conectar tu
            backend a la API de evidencia.
          </p>
          {estado === 'autenticado' ? (
            <p className="dev-dashboard-session mb-0 mt-3">
              Sesión activa: <strong>{usuario?.email}</strong>
            </p>
          ) : (
            <p className="dev-dashboard-session mb-0 mt-3">
              <Link to="/dev/registro">Crea una cuenta</Link> o <Link to="/dev/login">inicia sesión</Link> para enviar
              solicitudes y ver credenciales.
            </p>
          )}
        </div>
      </section>

      <div className="container-xl dev-dashboard-body">
        <div className="row g-3 dev-dashboard-cards-row">
          {ACCIONES.map((a) => (
            <div key={a.titulo} className="col-6 col-lg-3">
              <article
                className={`card dev-dashboard-card h-100 text-center${a.primary ? ' dev-dashboard-card-featured' : ''}`}
              >
                <div className="card-body d-flex flex-column align-items-center">
                  <span className="dev-dashboard-card-icon">
                    <a.icon size={40} stroke={1.4} />
                  </span>
                  <h2 className="dev-dashboard-card-title">{a.titulo}</h2>
                  <p className="dev-dashboard-card-text flex-grow-1">{a.descripcion}</p>
                  {'docs' in a && a.docs ? (
                    <ul className="dev-dashboard-docs-list">
                      <li>
                        POST/PUT <code>/datos</code>
                      </li>
                      <li>Cliente generado al definir payload</li>
                      <li>Credenciales al activar tenant</li>
                    </ul>
                  ) : a.to ? (
                    <Link to={a.to} className="dev-dashboard-card-link mt-auto">
                      {a.cta}
                      <IconChevronRight size={18} stroke={1.75} aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </article>
            </div>
          ))}
        </div>

        <section className="dev-dashboard-flow-section">
          <div className="dev-dashboard-flow-header">
            <h2 className="dev-dashboard-section-title">Flujo de integración</h2>
            <p className="dev-dashboard-section-subtitle mb-0">
              Del registro del integrador a la conexión con tu backend
            </p>
          </div>
          <div className="dev-dashboard-flow-track" aria-label="Etapas del proceso de integración">
            {FLUJO.map((f, i) => (
              <div key={f.paso} className="dev-dashboard-flow-step">
                <div className="dev-dashboard-flow-step-top">
                  <span className="dev-dashboard-flow-number">{f.paso}</span>
                  {i < FLUJO.length - 1 ? <span className="dev-dashboard-flow-connector" aria-hidden /> : null}
                </div>
                <p className="dev-dashboard-flow-label">{f.titulo}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

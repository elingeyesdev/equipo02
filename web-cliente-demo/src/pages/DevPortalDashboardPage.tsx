import { Link } from 'react-router-dom'
import {
  IconBook,
  IconClipboardList,
  IconForms,
  IconRobot,
} from '@tabler/icons-react'
import { useDevAuth } from '../context/DevAuthContext'

const FLUJO = [
  { paso: 1, titulo: 'Registro del integrador', badge: 'bg-primary' },
  { paso: 2, titulo: 'Solicitud de tenant', badge: 'bg-primary' },
  { paso: 3, titulo: 'Revisión del operador', badge: 'bg-warning' },
  { paso: 4, titulo: 'Provisioning', badge: 'bg-info' },
  { paso: 5, titulo: 'Credenciales activas', badge: 'bg-success' },
  { paso: 6, titulo: 'Integración con backend cliente', badge: 'bg-success' },
] as const

export default function DevPortalDashboardPage() {
  const { estado, usuario } = useDevAuth()

  return (
    <div className="container-xl py-4">
      <div className="page-header mb-4">
        <div className="row align-items-center">
          <div className="col">
            <h1 className="page-title">Portal Integrador Nexum</h1>
            <p className="text-secondary mt-1 mb-0">
              Solicita y gestiona la integración de tu sistema con la API blockchain de Nexum.
            </p>
            {estado === 'autenticado' ? (
              <p className="text-secondary small mt-2 mb-0">
                Sesión: <strong>{usuario?.email}</strong> · Conecta tu sistema a Nexum desde aquí.
              </p>
            ) : (
              <p className="text-secondary small mt-2 mb-0">
                <Link to="/dev/registro">Crea una cuenta</Link>
                {' '}o{' '}
                <Link to="/dev/login">inicia sesión</Link>
                {' '}para enviar solicitudes y ver credenciales.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="row row-cards g-4">
        <div className="col-md-6 col-xl-3">
          <div className="card card-sm h-100 border-primary">
            <div className="card-body d-flex flex-column">
              <div className="d-flex flex-wrap gap-2 mb-2">
                <span className="badge bg-primary-lt text-primary">Recomendado</span>
                <span className="badge bg-secondary-lt text-secondary">Requiere cuenta integrador</span>
              </div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="avatar bg-primary text-white">
                  <IconForms size={20} />
                </span>
                <h3 className="card-title mb-0">Nueva solicitud de integración</h3>
              </div>
              <p className="text-secondary small flex-grow-1">
                Registra tu organización, define el tenant y describe qué datos deseas enviar a blockchain.
              </p>
              <Link to="/dev/solicitud" className="btn btn-primary w-100 mt-3">
                Crear solicitud
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card card-sm h-100">
            <div className="card-body d-flex flex-column">
              <span className="badge bg-secondary-lt text-secondary mb-2 w-auto align-self-start">
                Requiere cuenta integrador
              </span>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="avatar bg-azure text-white">
                  <IconRobot size={20} />
                </span>
                <h3 className="card-title mb-0">Asistente de integración</h3>
              </div>
              <p className="text-secondary small flex-grow-1">
                Usa el asistente IA para ayudarte a estructurar el payload, definir atributos y generar ejemplos de
                integración.
              </p>
              <Link to="/dev/asistente" className="btn btn-outline-primary w-100 mt-3">
                Abrir asistente
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card card-sm h-100">
            <div className="card-body d-flex flex-column">
              <span className="badge bg-secondary-lt text-secondary mb-2 w-auto align-self-start">
                Requiere cuenta integrador
              </span>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="avatar bg-secondary text-white">
                  <IconClipboardList size={20} />
                </span>
                <h3 className="card-title mb-0">Mis solicitudes</h3>
              </div>
              <p className="text-secondary small flex-grow-1">
                Consulta el estado de tus solicitudes enviadas y revisa si ya fueron aprobadas.
              </p>
              <Link to="/dev/mis-solicitudes" className="btn btn-outline-secondary w-100 mt-3">
                Ver solicitudes
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card card-sm h-100 bg-light">
            <div className="card-body d-flex flex-column">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="avatar bg-yellow text-dark">
                  <IconBook size={20} />
                </span>
                <h3 className="card-title mb-0">Documentación rápida</h3>
              </div>
              <p className="text-secondary small flex-grow-1">
                Revisa cómo conectar tu backend usando Laravel, Node.js o cURL con la API blockchain de Nexum.
              </p>
              <ul className="small text-secondary mb-0 ps-3">
                <li>POST/PUT <code>/datos</code> con API key integrador</li>
                <li>Controller y cliente generados al diseñar el payload</li>
                <li>Credenciales disponibles cuando el tenant esté activo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h3 className="card-title">Flujo de integración</h3>
          <div className="card-subtitle text-secondary">
            Desde el registro hasta conectar tu backend con Nexum
          </div>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {FLUJO.map((f) => (
              <div key={f.paso} className="col-6 col-md-4 col-lg-2">
                <div className="text-center p-3 rounded border bg-white h-100">
                  <span className={`badge ${f.badge} mb-2`}>{f.paso}</span>
                  <p className="small fw-semibold mb-0">{f.titulo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

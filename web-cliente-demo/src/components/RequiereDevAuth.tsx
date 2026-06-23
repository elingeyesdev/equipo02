import { type ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { useDevAuth } from '../context/DevAuthContext'

type Props = {
  children: ReactElement
  title: string
  message: string
}

/**
 * Protege rutas del portal integrador sin modificar DevAuthContext.
 * Muestra una card de acceso si no hay sesión dev; conserva `from` para login/registro.
 */
export function RequiereDevAuth({ children, title, message }: Props) {
  const { estado } = useDevAuth()
  const location = useLocation()
  const from = location.pathname + location.search

  if (estado === 'verificando') {
    return (
      <div className="container-xl py-5 d-flex justify-content-center">
        <div className="card">
          <div className="card-body d-flex align-items-center gap-3 text-secondary">
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
            Validando sesión…
          </div>
        </div>
      </div>
    )
  }

  if (estado !== 'autenticado') {
    return (
      <div className="dev-auth-gate">
        <div className="container-xl py-5">
          <div className="row justify-content-center">
            <div className="col-md-8 col-lg-5">
              <div className="card dev-auth-gate-card">
                <div className="card-body text-center py-5 px-4">
                  <h2 className="dev-auth-gate-title">{title}</h2>
                  <p className="dev-auth-gate-message">{message}</p>
                  <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                    <Link to="/dev/login" state={{ from }} className="btn btn-dev-login">
                      Iniciar sesión
                    </Link>
                    <Link to="/dev/registro" state={{ from }} className="btn btn-outline-primary">
                      Crear cuenta
                    </Link>
                  </div>
                  <Link to="/dev" className="dev-portal-inline-link dev-portal-inline-link-back mt-4">
                    <IconChevronLeft size={18} stroke={1.75} aria-hidden />
                    Volver al portal
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return children
}

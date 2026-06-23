import { type ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
      <div className="container-xl py-5">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card">
              <div className="card-body text-center py-5 px-4">
                <h2 className="h4 mb-3">{title}</h2>
                <p className="text-secondary mb-4">{message}</p>
                <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                  <Link to="/dev/login" state={{ from }} className="btn btn-primary">
                    Iniciar sesión
                  </Link>
                  <Link to="/dev/registro" state={{ from }} className="btn btn-outline-primary">
                    Crear cuenta
                  </Link>
                </div>
                <Link to="/dev" className="d-inline-block mt-4 small text-secondary">
                  ← Volver al portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return children
}

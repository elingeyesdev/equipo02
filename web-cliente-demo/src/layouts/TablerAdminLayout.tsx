import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { guardarTokenPlataforma, leerTokenPlataforma } from '../services/platformApi'
import '../operador-console.css'

export function TablerAdminLayout() {
  const navigate = useNavigate()
  const hasSession = !!leerTokenPlataforma()

  const cerrarSesionOperador = () => {
    guardarTokenPlataforma(null)
    navigate('/admin/solicitudes', { replace: true })
    window.location.reload()
  }

  return (
    <div className="page operador-console">
      <header className="navbar operador-navbar d-print-none" data-bs-theme="dark">
        <div className="container-xl">
          <span className="operador-navbar-brand">
            <span className="operador-navbar-logo">NEXUM</span>
            Consola Operador BaaS
          </span>
          <ul className="operador-navbar-nav">
            <li>
              <NavLink
                to="/admin/solicitudes"
                end
                className={({ isActive }) => `operador-navbar-link nav-link ${isActive ? 'active' : ''}`}
              >
                Solicitudes
              </NavLink>
            </li>
            {hasSession ? (
              <li>
                <button type="button" className="operador-btn-outline-light" onClick={cerrarSesionOperador}>
                  Cerrar sesión operador
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </header>
      <div className="operador-page-body">
        <Outlet />
      </div>
    </div>
  )
}

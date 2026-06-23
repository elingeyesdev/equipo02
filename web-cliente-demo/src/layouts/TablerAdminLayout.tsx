import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { guardarTokenPlataforma, leerTokenPlataforma } from '../services/platformApi'

export function TablerAdminLayout() {
  const navigate = useNavigate()
  const hasSession = !!leerTokenPlataforma()

  const cerrarSesionOperador = () => {
    guardarTokenPlataforma(null)
    navigate('/admin/solicitudes', { replace: true })
    window.location.reload()
  }

  return (
    <div className="page">
      <header className="navbar navbar-expand-md navbar-light d-print-none border-bottom bg-dark" data-bs-theme="dark">
        <div className="container-xl">
          <span className="navbar-brand text-white">Consola Operador BaaS</span>
          <ul className="navbar-nav ms-auto flex-row align-items-center gap-2">
            <li className="nav-item">
              <NavLink
                to="/admin/solicitudes"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Solicitudes
              </NavLink>
            </li>
            {hasSession ? (
              <li className="nav-item">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  onClick={cerrarSesionOperador}
                >
                  Cerrar sesión operador
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </header>
      <div className="page-wrapper">
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

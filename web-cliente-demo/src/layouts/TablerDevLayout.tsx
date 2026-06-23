import { Link, NavLink, Outlet } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'

export function TablerDevLayout() {
  const { estado, usuario, logout } = useDevAuth()

  return (
    <div className="page">
      <header className="navbar navbar-expand-md navbar-light d-print-none border-bottom">
        <div className="container-xl">
          <Link to="/dev" className="navbar-brand text-primary fw-bold">
            Portal Integrador Nexum
          </Link>
          <div className="navbar-nav flex-row order-md-last gap-2">
            {estado === 'autenticado' ? (
              <span className="nav-link text-secondary small">{usuario?.email}</span>
            ) : (
              <>
                <Link to="/dev/registro" className="btn btn-sm btn-primary">
                  Registrarse
                </Link>
                <Link to="/dev/login" className="btn btn-sm btn-outline-primary">
                  Entrar
                </Link>
              </>
            )}
            {estado === 'autenticado' ? (
              <button type="button" className="btn btn-sm btn-ghost-secondary" onClick={() => void logout()}>
                Salir
              </button>
            ) : null}
          </div>
          <div className="collapse navbar-collapse show" id="dev-nav">
            <ul className="navbar-nav">
              <li className="nav-item">
                <NavLink to="/dev" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Inicio
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/dev/solicitud" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Nueva solicitud
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/dev/asistente" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Asistente IA
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/dev/mis-solicitudes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Mis solicitudes
                </NavLink>
              </li>
              <li className="nav-item">
                <Link to="/admin/solicitudes" className="nav-link">
                  Operador
                </Link>
              </li>
            </ul>
          </div>
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

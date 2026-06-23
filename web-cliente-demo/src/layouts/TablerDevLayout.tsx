import { Link, Outlet, useLocation } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'

const LOGO_BLANCO = '/logoNexumBlanco.png'

function DevPortalLogo({ dark = false }: { dark?: boolean }) {
  return (
    <img
      src={LOGO_BLANCO}
      alt="Nexum"
      className={`dev-portal-brand-logo${dark ? ' dev-portal-brand-logo-dark' : ''}`}
      height={36}
    />
  )
}

export function TablerDevLayout() {
  const { estado, usuario, logout } = useDevAuth()
  const { pathname } = useLocation()
  const esAuth = pathname === '/dev/login' || pathname === '/dev/registro'

  return (
    <div className="page dev-portal-page">
      <header
        className={`navbar d-print-none ${esAuth ? 'dev-portal-navbar dev-portal-navbar-auth' : 'dev-portal-navbar dev-portal-navbar-main'}`}
      >
        <div className="container-xl dev-portal-navbar-inner">
          <Link to="/" className="navbar-brand dev-portal-brand">
            <DevPortalLogo dark={esAuth} />
          </Link>

          <div className="dev-portal-nav-actions">
            {estado === 'autenticado' ? (
              <span className="dev-portal-user-email">{usuario?.email}</span>
            ) : (
              <>
                <Link
                  to="/dev/registro"
                  className={`btn btn-sm ${pathname === '/dev/registro' ? 'btn-landing-primary' : esAuth ? 'btn-outline-primary' : 'btn-dev-nav-ghost'}`}
                >
                  Registrarse
                </Link>
                <Link
                  to="/dev/login"
                  className={`btn btn-sm ${pathname === '/dev/login' ? 'btn-landing-primary' : esAuth ? 'btn-outline-primary' : 'btn-dev-nav-ghost'}`}
                >
                  Entrar
                </Link>
              </>
            )}
            {estado === 'autenticado' ? (
              <button type="button" className="btn btn-sm btn-dev-nav-ghost" onClick={() => void logout()}>
                Salir
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <div className={`page-wrapper${esAuth ? ' dev-portal-auth-wrapper' : ' dev-portal-main-wrapper'}`}>
        <div className="page-body p-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

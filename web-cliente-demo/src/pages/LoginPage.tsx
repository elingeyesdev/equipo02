import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconChevronLeft, IconLock, IconUser } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { PasswordInput } from '../components/PasswordInput'

const IMG_HERO = '/landing/hero.png'

interface LocationState {
  from?: string
}

export default function LoginPage() {
  const { login, estado } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (estado === 'autenticado') {
      const to = (location.state as LocationState | null)?.from ?? '/app'
      navigate(to, { replace: true })
    }
  }, [estado, navigate, location.state])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario.trim() || !contrasena) {
      setError('Usuario y contraseña son obligatorios.')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await login(usuario.trim(), contrasena)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
      setError(msg)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="landing-marketing client-login-page">
      <main className="client-login-main">
        <Link to="/" className="client-login-back">
          <IconChevronLeft size={18} stroke={1.75} aria-hidden />
          Página principal
        </Link>

        <div className="container-xl">
          <div className="row g-4 g-xl-5 align-items-center client-login-grid">
            <div className="col-lg-6 client-login-info">
              <p className="client-login-eyebrow">Panel privado</p>
              <h1 className="client-login-title">Consola de auditoría del puente</h1>
              <p className="client-login-lead">
                Consulta historial, trazabilidad y eventos de la red. Acceso de solo lectura para revisar lo
                registrado por tu organización.
              </p>
              <div className="client-login-visual">
                <img
                  src={IMG_HERO}
                  alt="Integración API y evidencia en blockchain"
                  className="client-login-illustration"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

            <div className="col-lg-6 client-login-form-col">
              <div className="client-login-card-wrap">
                <div className="card client-login-card">
                  <div className="card-body">
                    <h2 className="client-login-card-title">Iniciar sesión</h2>
                    <p className="client-login-card-subtitle">
                      Usa las credenciales asignadas a tu organización para acceder al panel privado.
                    </p>

                    <form onSubmit={submit} className="client-login-form">
                      <div className="client-login-field">
                        <label className="form-label" htmlFor="client-login-usuario">
                          Usuario
                        </label>
                        <div className="client-login-input-wrap">
                          <IconUser size={18} stroke={1.75} className="client-login-input-icon" aria-hidden />
                          <input
                            id="client-login-usuario"
                            type="text"
                            autoComplete="username"
                            className="form-control client-login-input"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            disabled={enviando}
                            placeholder="Tu usuario de acceso"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="client-login-field">
                        <label className="form-label" htmlFor="client-login-password">
                          Contraseña
                        </label>
                        <PasswordInput
                          id="client-login-password"
                          aria-label="Contraseña"
                          autoComplete="current-password"
                          className="form-control client-login-input"
                          wrapperClassName="client-login-input-wrap password-input-wrap"
                          toggleClassName="password-input-toggle client-login-password-toggle"
                          value={contrasena}
                          onChange={setContrasena}
                          disabled={enviando}
                          placeholder="Tu contraseña"
                          startIcon={
                            <IconLock size={18} stroke={1.75} className="client-login-input-icon" aria-hidden />
                          }
                        />
                      </div>

                      {error ? <p className="client-login-error">{error}</p> : null}

                      <button type="submit" disabled={enviando} className="btn btn-landing-primary w-100 client-login-submit">
                        {enviando ? 'Validando…' : 'Iniciar sesión'}
                      </button>
                    </form>
                  </div>
                </div>

                <p className="client-login-footer-link">
                  ¿Quieres integrar tu sistema?{' '}
                  <Link to="/dev">Solicitar integración</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'
import { PasswordInput } from '../components/PasswordInput'

export default function DevLoginPage() {
  const { login, estado } = useDevAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dev'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (estado === 'autenticado') {
      navigate(from, { replace: true })
    }
  }, [estado, from, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dev-auth-page">
      <form onSubmit={submit} className="card dev-auth-card">
        <div className="card-body">
          <h1 className="dev-auth-title">Iniciar sesión</h1>
          <p className="dev-auth-subtitle">Accede para enviar y seguir tus solicitudes BaaS</p>

          <div className="dev-auth-field">
            <label className="form-label" htmlFor="dev-login-email">
              Email
            </label>
            <input
              id="dev-login-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="dev-auth-field">
            <label className="form-label" htmlFor="dev-login-password">
              Contraseña
            </label>
            <PasswordInput
              id="dev-login-password"
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="text-danger small mt-3 mb-0">{error}</p> : null}

          <button type="submit" disabled={busy} className="btn btn-dev-login w-100 dev-auth-submit mt-4">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="dev-auth-footer-link mb-0">
            ¿Sin cuenta?{' '}
            <Link to="/dev/registro" state={{ from }}>
              Regístrate
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'
import { PasswordInput } from '../components/PasswordInput'

export default function DevRegisterPage() {
  const { register } = useDevAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dev'
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register(email.trim(), password, nombre.trim())
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dev-auth-page">
      <form onSubmit={submit} className="card dev-auth-card">
        <div className="card-body">
          <h1 className="dev-auth-title">Crear cuenta dev</h1>
          <p className="dev-auth-subtitle">Para solicitar alta en el BaaS y ver el estado</p>

          <div className="dev-auth-field">
            <label className="form-label" htmlFor="dev-register-nombre">
              Nombre
            </label>
            <input
              id="dev-register-nombre"
              className="form-control"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="dev-auth-field">
            <label className="form-label" htmlFor="dev-register-email">
              Email
            </label>
            <input
              id="dev-register-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="dev-auth-field">
            <label className="form-label" htmlFor="dev-register-password">
              Contraseña
            </label>
            <PasswordInput
              id="dev-register-password"
              value={password}
              onChange={setPassword}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error ? <p className="text-danger small mt-3 mb-0">{error}</p> : null}

          <button type="submit" disabled={busy} className="btn btn-dev-register w-100 dev-auth-submit mt-4">
            {busy ? 'Creando…' : 'Crear cuenta'}
          </button>

          <p className="dev-auth-footer-link mb-0">
            <Link to="/dev/login" state={{ from }}>
              Ya tengo cuenta
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}

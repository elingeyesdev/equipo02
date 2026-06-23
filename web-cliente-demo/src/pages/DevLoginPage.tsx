import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'

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
    <div className="container-xl py-5 d-flex justify-content-center">
      <form onSubmit={submit} className="card w-100" style={{ maxWidth: '24rem' }}>
        <div className="card-body">
          <h1 className="h3">Dev portal</h1>
          <p className="text-secondary small">Accede para enviar y seguir tus solicitudes BaaS</p>
          <label className="form-label mt-3">
            Email
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="form-label mt-2">
            Contraseña
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <p className="text-danger small mt-2">{error}</p> : null}
          <button type="submit" disabled={busy} className="btn btn-primary w-100 mt-3">
            {busy ? 'Entrando…' : 'Iniciar sesión'}
          </button>
          <p className="text-center small text-secondary mt-3 mb-0">
            ¿Sin cuenta? <Link to="/dev/registro" state={{ from }}>Regístrate</Link>
          </p>
          <Link to="/dev" className="d-block text-center small text-secondary mt-2">← Volver al portal</Link>
        </div>
      </form>
    </div>
  )
}

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'

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
    <div className="container-xl py-5 d-flex justify-content-center">
      <form onSubmit={submit} className="card w-100" style={{ maxWidth: '24rem' }}>
        <div className="card-body">
          <h1 className="h3">Crear cuenta dev</h1>
          <p className="text-secondary small">Para solicitar alta en el BaaS y ver el estado</p>
          <label className="form-label mt-3">
            Nombre
            <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
          <label className="form-label mt-2">
            Email
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="form-label mt-2">
            Contraseña
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>
          {error ? <p className="text-danger small mt-2">{error}</p> : null}
          <button type="submit" disabled={busy} className="btn btn-warning w-100 mt-3">
            {busy ? 'Creando…' : 'Crear cuenta'}
          </button>
          <p className="text-center small mt-3 mb-0">
            <Link to="/dev/login" state={{ from }}>Ya tengo cuenta</Link>
          </p>
        </div>
      </form>
    </div>
  )
}

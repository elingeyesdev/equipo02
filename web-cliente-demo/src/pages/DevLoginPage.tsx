import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { inputClass } from '../components/onboarding/OnboardingUi'
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f4f7fb] px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line/60 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-[#1a2332]">Dev portal</h1>
        <p className="mt-1 text-sm text-[#6b7280]">Accede para enviar y seguir tus solicitudes BaaS</p>
        <label className="mt-6 block text-xs font-medium text-[#6b7280]">
          Email
          <input type="email" className={`${inputClass} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mt-4 block text-xs font-medium text-[#6b7280]">
          Contraseña
          <input type="password" className={`${inputClass} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={busy} className="mt-6 w-full rounded-full bg-[#1a3a5c] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Entrando…' : 'Iniciar sesión'}
        </button>
        <p className="mt-4 text-center text-sm text-[#6b7280]">
          ¿Sin cuenta? <Link to="/dev/registro" className="font-medium text-[#1a3a5c]">Regístrate</Link>
        </p>
        <Link to="/dev" className="mt-3 block text-center text-xs text-[#6b7280]">← Volver al chat</Link>
      </form>
    </div>
  )
}

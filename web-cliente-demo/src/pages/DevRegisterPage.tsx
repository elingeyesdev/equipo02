import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { inputClass } from '../components/onboarding/OnboardingUi'
import { useDevAuth } from '../context/DevAuthContext'

export default function DevRegisterPage() {
  const { register } = useDevAuth()
  const navigate = useNavigate()
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
      navigate('/dev', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f4f7fb] px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line/60 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold">Crear cuenta dev</h1>
        <p className="mt-1 text-sm text-[#6b7280]">Para solicitar alta en el BaaS y ver el estado sin correo</p>
        <label className="mt-6 block text-xs font-medium text-[#6b7280]">
          Nombre
          <input className={`${inputClass} mt-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="mt-4 block text-xs font-medium text-[#6b7280]">
          Email
          <input type="email" className={`${inputClass} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mt-4 block text-xs font-medium text-[#6b7280]">
          Contraseña
          <input type="password" className={`${inputClass} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={busy} className="mt-6 w-full rounded-full bg-[#f0b429] py-2.5 text-sm font-bold text-[#1a2332] disabled:opacity-50">
          {busy ? 'Creando…' : 'Crear cuenta'}
        </button>
        <p className="mt-4 text-center text-sm">
          <Link to="/dev/login" className="text-[#1a3a5c]">Ya tengo cuenta</Link>
        </p>
      </form>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface LocationState {
  from?: string
}

const inputClass =
  'w-full rounded-lg border border-line/80 bg-white px-3.5 py-2.5 pl-10 text-sm text-[#1a2332] outline-none placeholder:text-[#9ca3af] transition-shadow focus:border-[#1a3a5c]/40 focus:ring-2 focus:ring-[#1a3a5c]/10 disabled:bg-[#f9fafb] disabled:text-[#9ca3af]'

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
    <div className="flex min-h-[100dvh] bg-[#f4f7fb]">
      <div className="landing-hero relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex xl:p-12">
        <div className="landing-blob pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full opacity-70" aria-hidden />
        <div className="relative z-10">
          <Link to="/" className="text-xl font-bold uppercase tracking-[0.08em] text-white">
            Nexum
          </Link>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="text-sm font-medium text-[#f0b429]">Panel privado</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Consola de auditoría del puente
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Consulta historial, trazabilidad y eventos de la red. Acceso de solo lectura para revisar lo
            registrado por tu organización.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'Historial y trazabilidad en tiempo real',
              'Auditoría de operaciones del middleware',
              'Espacio aislado por tenant y rol',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <ShieldCheck className="h-4 w-4 text-[#f0b429]" strokeWidth={1.8} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/45">Nexum · Middleware blockchain sobre Hyperledger Fabric</p>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line/60 bg-white/90 px-5 py-4 backdrop-blur-sm lg:hidden">
          <Link to="/" className="text-sm font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">
            Nexum
          </Link>
          <Link to="/" className="text-xs font-medium text-[#6b7280] hover:text-[#1a3a5c]">
            Volver al inicio
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            <Link
              to="/"
              className="mb-8 hidden items-center gap-1.5 text-sm font-medium text-[#6b7280] transition-colors hover:text-[#1a3a5c] lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Volver al inicio
            </Link>

            <div className="lg:hidden">
              <p className="text-sm font-medium text-[#c48f12]">Acceso al panel</p>
              <h2 className="mt-1 text-2xl font-bold text-[#1a2332]">Iniciar sesión</h2>
              <p className="mt-2 text-sm text-[#6b7280]">
                Entra a la consola de auditoría de tu organización.
              </p>
            </div>

            <div className="hidden lg:block">
              <h2 className="text-2xl font-bold text-[#1a2332]">Iniciar sesión</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                Usa las credenciales asignadas a tu organización para acceder al panel privado.
              </p>
            </div>

            <form
              onSubmit={submit}
              className="mt-8 rounded-3xl border border-line/60 bg-white p-6 shadow-sm sm:p-8"
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#374151]">Usuario</span>
                <span className="relative block">
                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
                    strokeWidth={1.8}
                  />
                  <input
                    type="text"
                    autoComplete="username"
                    className={inputClass}
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    disabled={enviando}
                    placeholder="Tu usuario de acceso"
                    autoFocus
                  />
                </span>
              </label>

              <label className="mt-5 block">
                <span className="mb-1.5 block text-sm font-medium text-[#374151]">Contraseña</span>
                <span className="relative block">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
                    strokeWidth={1.8}
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={inputClass}
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    disabled={enviando}
                    placeholder="••••••••"
                  />
                </span>
              </label>

              {error ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={enviando}
                className="mt-6 w-full rounded-full bg-[#1a3a5c] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f2844] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? 'Validando…' : 'Iniciar sesión'}
              </button>

              <p className="mt-5 text-center text-xs leading-relaxed text-[#9ca3af]">
                Las cuentas las crea el operador del BaaS en{' '}
                <code className="rounded bg-[#f4f7fb] px-1.5 py-0.5 font-mono text-[11px] text-[#6b7280]">
                  config/usuarios-admin.yaml
                </code>
                .
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-[#6b7280]">
              ¿Quieres integrar tu sistema?{' '}
              <Link to="/dev/registro" className="font-semibold text-[#1a3a5c] hover:underline">
                Solicitar integración
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

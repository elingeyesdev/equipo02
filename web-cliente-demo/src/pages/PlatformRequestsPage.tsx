import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { inputClass } from '../components/onboarding/OnboardingUi'
import {
  leerTokenPlataforma,
  listarSolicitudesPlataforma,
  loginPlataforma,
} from '../services/platformApi'
import type { DevTenantRequest } from '../services/devPortalApi'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  provisioning: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function PlatformRequestsPage() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(!!leerTokenPlataforma())
  const [user, setUser] = useState('platform-admin')
  const [pass, setPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [list, setList] = useState<DevTenantRequest[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const items = await listarSolicitudesPlataforma()
      setList(items)
    } catch {
      setAuthed(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) void load()
  }, [authed])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    try {
      await loginPlataforma(user, pass)
      setAuthed(true)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login fallido')
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f4f7fb] px-4">
        <form onSubmit={onLogin} className="w-full max-w-sm rounded-2xl border border-line/60 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#1a2332]">Operador BaaS</h1>
          <p className="mt-1 text-sm text-[#6b7280]">Cola de solicitudes del dev portal</p>
          <label className="mt-6 block text-xs font-medium text-[#6b7280]">
            Usuario
            <input className={`${inputClass} mt-1`} value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label className="mt-4 block text-xs font-medium text-[#6b7280]">
            Contraseña
            <input type="password" className={`${inputClass} mt-1`} value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {loginError ? <p className="mt-3 text-sm text-red-600">{loginError}</p> : null}
          <button type="submit" className="mt-6 w-full rounded-full bg-[#1a3a5c] py-2.5 text-sm font-semibold text-white">
            Entrar
          </button>
          <Link to="/dev" className="mt-4 block text-center text-sm text-[#6b7280]">← Dev portal cliente</Link>
        </form>
      </div>
    )
  }

  const pending = list.filter((s) => s.status === 'pending' || s.status === 'provisioning')

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <h1 className="text-lg font-bold text-[#1a2332]">Solicitudes BaaS</h1>
          <button type="button" className="text-sm text-[#6b7280]" onClick={() => void load()}>
            Refrescar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <p className="text-sm text-[#6b7280]">
          {pending.length} en cola (pending / provisioning)
        </p>

        {loading ? <p className="mt-4 text-sm">Cargando…</p> : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-line/60 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f7fb] text-xs uppercase text-[#6b7280]">
              <tr>
                <th className="px-4 py-3">Organización</th>
                <th className="px-4 py-3">tenant_id</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-[#fafbfd]">
                  <td className="px-4 py-3 font-medium">{s.orgName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.tenantId}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[s.status] ?? ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.contactEmail}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1a3a5c]"
                      onClick={() => navigate(`/admin/solicitudes/${s.id}`)}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6b7280]">
                    Sin solicitudes
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

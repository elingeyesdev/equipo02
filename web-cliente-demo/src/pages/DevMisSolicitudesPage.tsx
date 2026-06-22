import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDevAuth } from '../context/DevAuthContext'
import { listMisSolicitudes, type DevTenantRequest } from '../services/devPortalApi'

const BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  provisioning: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function DevMisSolicitudesPage() {
  const { estado, usuario, logout } = useDevAuth()
  const [list, setList] = useState<DevTenantRequest[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (estado !== 'autenticado') return
    void listMisSolicitudes()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
  }, [estado])

  if (estado === 'sin-sesion' || estado === 'verificando') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#f4f7fb]">
        <p className="text-sm text-[#6b7280]">Inicia sesión para ver tus solicitudes</p>
        <Link to="/dev/login" className="rounded-full bg-[#1a3a5c] px-5 py-2 text-sm font-semibold text-white">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#f4f7fb]">
      <header className="border-b border-line/60 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Mis solicitudes</h1>
            <p className="text-xs text-[#6b7280]">{usuario?.email}</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link to="/dev" className="text-[#1a3a5c]">Nueva solicitud</Link>
            <button type="button" className="text-[#6b7280]" onClick={() => void logout()}>
              Salir
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="overflow-hidden rounded-2xl border border-line/60 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f7fb] text-xs uppercase text-[#6b7280]">
              <tr>
                <th className="px-4 py-3">Organización</th>
                <th className="px-4 py-3">tenant</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.orgName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.tenantId}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[s.status] ?? ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/dev/estado/${s.id}`} className="text-xs font-semibold text-[#1a3a5c]">
                      Ver estado
                    </Link>
                  </td>
                </tr>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#6b7280]">
                    Aún no has enviado solicitudes. <Link to="/dev" className="text-[#1a3a5c]">Empezar</Link>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[#6b7280]">
          Esta página se actualiza al recargar. Cuando el operador active tu tenant, el estado pasará a <strong>active</strong>.
        </p>
      </div>
    </div>
  )
}

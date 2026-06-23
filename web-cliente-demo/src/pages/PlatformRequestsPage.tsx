import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DevRequestStatusBadge,
  formatDevRequestDate,
  OPERATOR_NEXT_STEP,
} from '../components/dev/DevRequestStatusUi'
import { PasswordInput } from '../components/PasswordInput'
import {
  leerTokenPlataforma,
  listarSolicitudesPlataforma,
  loginPlataforma,
} from '../services/platformApi'
import type { DevRequestStatus, DevTenantRequest } from '../services/devPortalApi'

type FiltroEstado = 'all' | DevRequestStatus

const FILTROS: { id: FiltroEstado; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'En revisión' },
  { id: 'provisioning', label: 'Provisioning' },
  { id: 'active', label: 'Activas' },
  { id: 'rejected', label: 'Rechazadas' },
]

function normalizarLista(items: DevTenantRequest[] | null | undefined): DevTenantRequest[] {
  return Array.isArray(items) ? items : []
}

export default function PlatformRequestsPage() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(!!leerTokenPlataforma())
  const [user, setUser] = useState('platform-admin')
  const [pass, setPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [list, setList] = useState<DevTenantRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [filtro, setFiltro] = useState<FiltroEstado>('all')

  const load = async () => {
    setLoading(true)
    try {
      const items = await listarSolicitudesPlataforma()
      setList(normalizarLista(items))
    } catch {
      setAuthed(false)
      setList([])
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

  const lista = useMemo(() => normalizarLista(list), [list])

  const conteos = useMemo(
    () => ({
      total: lista.length,
      pending: lista.filter((s) => s.status === 'pending').length,
      provisioning: lista.filter((s) => s.status === 'provisioning').length,
      active: lista.filter((s) => s.status === 'active').length,
      rejected: lista.filter((s) => s.status === 'rejected').length,
    }),
    [lista],
  )

  const filtrada = useMemo(() => {
    if (filtro === 'all') return lista
    return lista.filter((s) => s.status === filtro)
  }, [lista, filtro])

  if (!authed) {
    return (
      <div className="container-xl py-5 d-flex justify-content-center">
        <form onSubmit={onLogin} className="card w-100" style={{ maxWidth: '24rem' }}>
          <div className="card-body">
            <h1 className="h3">Consola Operador BaaS</h1>
            <p className="text-secondary small">Acceso para revisar solicitudes del Portal Integrador</p>
            <label className="form-label mt-3">
              Usuario
              <input className="form-control" value={user} onChange={(e) => setUser(e.target.value)} />
            </label>
            <label className="form-label mt-2">
              Contraseña
              <PasswordInput value={pass} onChange={setPass} autoComplete="current-password" />
            </label>
            {loginError ? <p className="text-danger small mt-2">{loginError}</p> : null}
            <button type="submit" className="btn btn-primary w-100 mt-3">
              Entrar
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="container-xl py-4">
      <div className="page-header mb-4">
        <div className="row align-items-center">
          <div className="col">
            <h1 className="page-title">Solicitudes de integración</h1>
            <p className="text-secondary mb-0">
              Revisa, aprueba y activa tenants solicitados desde el Portal Integrador Nexum.
            </p>
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-outline-secondary" onClick={() => void load()} disabled={loading}>
              {loading ? 'Actualizando…' : 'Refrescar'}
            </button>
          </div>
        </div>
      </div>

      <div className="row row-cards g-3 mb-4">
        <div className="col-6 col-md">
          <div className="card card-sm">
            <div className="card-body">
              <div className="text-secondary small">Total</div>
              <div className="h2 mb-0">{conteos.total}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card card-sm">
            <div className="card-body">
              <div className="text-secondary small">En revisión</div>
              <div className="h2 mb-0 text-warning">{conteos.pending}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card card-sm">
            <div className="card-body">
              <div className="text-secondary small">En provisioning</div>
              <div className="h2 mb-0 text-info">{conteos.provisioning}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card card-sm">
            <div className="card-body">
              <div className="text-secondary small">Activas</div>
              <div className="h2 mb-0 text-success">{conteos.active}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md">
          <div className="card card-sm">
            <div className="card-body">
              <div className="text-secondary small">Rechazadas</div>
              <div className="h2 mb-0 text-danger">{conteos.rejected}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="btn-list mb-3">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn btn-sm ${filtro === f.id ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && lista.length === 0 ? (
        <div className="card">
          <div className="card-body text-center text-secondary py-5">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
            Cargando solicitudes…
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5 px-4">
            <h2 className="h4 mb-3">No hay solicitudes de integración</h2>
            <p className="text-secondary mb-0">
              Cuando un integrador envíe una solicitud desde el Portal Integrador, aparecerá aquí para su
              revisión.
            </p>
          </div>
        </div>
      ) : filtrada.length === 0 ? (
        <div className="card">
          <div className="card-body text-center text-secondary py-4">
            No hay solicitudes con el filtro seleccionado.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Tenant ID</th>
                  <th>Integrador / contacto</th>
                  <th>Estado</th>
                  <th>Actualización</th>
                  <th>Próximo paso</th>
                  <th className="w-1" />
                </tr>
              </thead>
              <tbody>
                {filtrada.map((s) => {
                  const fecha = formatDevRequestDate(s.updatedAt ?? s.createdAt)
                  const next =
                    OPERATOR_NEXT_STEP[s.status as DevRequestStatus] ?? OPERATOR_NEXT_STEP.pending
                  return (
                    <tr key={s.id}>
                      <td className="fw-medium">{s.orgName}</td>
                      <td className="font-monospace small">{s.tenantId}</td>
                      <td className="small">{s.contactEmail}</td>
                      <td>
                        <DevRequestStatusBadge status={s.status} />
                      </td>
                      <td className="text-secondary small">{fecha ?? '—'}</td>
                      <td className="text-secondary small">{next}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => navigate(`/admin/solicitudes/${s.id}`)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

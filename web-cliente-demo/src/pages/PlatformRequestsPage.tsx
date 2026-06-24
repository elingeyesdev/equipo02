import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconRefresh } from '@tabler/icons-react'
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

const METRICAS: {
  key: keyof ReturnType<typeof buildConteos>
  label: string
  tone: string
}[] = [
  { key: 'total', label: 'Total', tone: 'total' },
  { key: 'pending', label: 'En revisión', tone: 'pending' },
  { key: 'provisioning', label: 'En provisioning', tone: 'provisioning' },
  { key: 'active', label: 'Activas', tone: 'active' },
  { key: 'rejected', label: 'Rechazadas', tone: 'rejected' },
]

function normalizarLista(items: DevTenantRequest[] | null | undefined): DevTenantRequest[] {
  return Array.isArray(items) ? items : []
}

function buildConteos(lista: DevTenantRequest[]) {
  return {
    total: lista.length,
    pending: lista.filter((s) => s.status === 'pending').length,
    provisioning: lista.filter((s) => s.status === 'provisioning').length,
    active: lista.filter((s) => s.status === 'active').length,
    rejected: lista.filter((s) => s.status === 'rejected').length,
  }
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
  const conteos = useMemo(() => buildConteos(lista), [lista])

  const filtrada = useMemo(() => {
    if (filtro === 'all') return lista
    return lista.filter((s) => s.status === filtro)
  }, [lista, filtro])

  if (!authed) {
    return (
      <div className="operador-login-shell">
        <form onSubmit={onLogin} className="operador-login-card">
          <div className="operador-login-logo">NEXUM</div>
          <h1 className="operador-login-title">Consola Operador BaaS</h1>
          <p className="operador-login-lead">
            Acceso interno para revisar solicitudes del Portal Integrador.
          </p>
          <label className="form-label">
            Usuario
            <input
              className="form-control operador-input mt-1"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </label>
          <label className="form-label mt-2">
            Contraseña
            <PasswordInput
              value={pass}
              onChange={setPass}
              autoComplete="current-password"
              className="form-control operador-input mt-1"
              wrapperClassName="operador-password-wrap mt-1"
              toggleClassName="operador-password-toggle"
            />
          </label>
          {loginError ? <p className="operador-login-error">{loginError}</p> : null}
          <button type="submit" className="operador-btn-primary mt-3">
            Entrar
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="operador-page">
      <div className="operador-page-header">
        <div>
          <h1 className="operador-page-title">Solicitudes de integración</h1>
          <p className="operador-page-lead">
            Revisa, aprueba y activa tenants solicitados desde el Portal Integrador Nexum.
          </p>
        </div>
        <button
          type="button"
          className="operador-btn-icon"
          onClick={() => void load()}
          disabled={loading}
          title="Refrescar solicitudes"
        >
          <IconRefresh size={16} stroke={1.75} />
          {loading ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>

      <div className="operador-metrics">
        {METRICAS.map((m) => (
          <div key={m.key} className={`operador-metric operador-metric--${m.tone}`}>
            <div className="operador-metric-label">
              <span className="operador-metric-dot" aria-hidden />
              {m.label}
            </div>
            <div className="operador-metric-value">{conteos[m.key]}</div>
          </div>
        ))}
      </div>

      <div className="operador-filters">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`operador-filter-chip${filtro === f.id ? ' is-active' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && lista.length === 0 ? (
        <div className="operador-panel">
          <div className="operador-panel-body operador-loading">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
            Cargando solicitudes…
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="operador-panel">
          <div className="operador-panel-body operador-panel-body--empty">
            <h2>No hay solicitudes de integración</h2>
            <p className="mb-0">
              Cuando un integrador envíe una solicitud desde el Portal Integrador, aparecerá aquí para su revisión.
            </p>
          </div>
        </div>
      ) : filtrada.length === 0 ? (
        <div className="operador-panel">
          <div className="operador-panel-body">No hay solicitudes con el filtro seleccionado.</div>
        </div>
      ) : (
        <div className="operador-panel">
          <div className="operador-table-wrap">
            <table className="operador-table">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Tenant ID</th>
                  <th>Integrador / contacto</th>
                  <th>Estado</th>
                  <th>Actualización</th>
                  <th>Próximo paso</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((s) => {
                  const fecha = formatDevRequestDate(s.updatedAt ?? s.createdAt)
                  const next =
                    OPERATOR_NEXT_STEP[s.status as DevRequestStatus] ?? OPERATOR_NEXT_STEP.pending
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.orgName}</td>
                      <td className="operador-cell-mono">{s.tenantId}</td>
                      <td className="operador-cell-truncate operador-cell-muted" title={s.contactEmail}>
                        {s.contactEmail}
                      </td>
                      <td>
                        <DevRequestStatusBadge status={s.status} />
                      </td>
                      <td className="operador-cell-muted">{fecha ?? '—'}</td>
                      <td className="operador-cell-muted">{next}</td>
                      <td>
                        <button
                          type="button"
                          className="operador-btn-sm"
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

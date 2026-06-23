import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DEV_STATUS_META,
  DevRequestStatusBadge,
  formatDevRequestDate,
} from '../components/dev/DevRequestStatusUi'
import { useDevAuth } from '../context/DevAuthContext'
import { listMisSolicitudes, type DevRequestStatus, type DevTenantRequest } from '../services/devPortalApi'

function formatListError(e: unknown): { auth: boolean; message: string } {
  if (e instanceof TypeError) {
    return {
      auth: false,
      message: 'No se pudo conectar con el servidor. Verifica que web-portal-api esté activo.',
    }
  }
  if (e instanceof Error) {
    const lower = e.message.toLowerCase()
    if (
      lower.includes('http 401') ||
      lower.includes('http 403') ||
      lower.includes('inicia sesión') ||
      lower.includes('inicia sesion') ||
      lower.includes('no autenticado') ||
      lower.includes('acceso_denegado')
    ) {
      return {
        auth: true,
        message: 'No tienes sesión activa de integrador. Inicia sesión nuevamente.',
      }
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return {
        auth: false,
        message: 'No se pudo conectar con el servidor. Verifica que web-portal-api esté activo.',
      }
    }
    return { auth: false, message: e.message }
  }
  return { auth: false, message: 'Error al cargar solicitudes.' }
}

export default function DevMisSolicitudesPage() {
  const { estado } = useDevAuth()
  const [list, setList] = useState<DevTenantRequest[]>([])
  const [error, setError] = useState<{ auth: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (estado !== 'autenticado') return
    setLoading(true)
    setError(null)
    void listMisSolicitudes()
      .then((items) => setList(Array.isArray(items) ? items : []))
      .catch((e) => {
        setList([])
        setError(formatListError(e))
      })
      .finally(() => setLoading(false))
  }, [estado])

  const listaSolicitudes = useMemo(
    () => (Array.isArray(list) ? list : []),
    [list],
  )

  const activeCount = listaSolicitudes.filter((s) => s.status === 'active').length
  const pendingCount = listaSolicitudes.filter(
    (s) => s.status === 'pending' || s.status === 'provisioning',
  ).length

  return (
    <div className="container-xl py-4">
      <div className="page-header mb-4">
        <h1 className="page-title">Mis solicitudes</h1>
        <p className="text-secondary mb-0">Seguimiento de tus integraciones con Nexum</p>
      </div>

      {listaSolicitudes.length > 0 ? (
        <div className="row row-cards mb-4">
          <div className="col-sm-4">
            <div className="card">
              <div className="card-body">
                <div className="text-secondary small">Total solicitudes</div>
                <div className="h2 mb-0">{listaSolicitudes.length}</div>
              </div>
            </div>
          </div>
          <div className="col-sm-4">
            <div className="card">
              <div className="card-body">
                <div className="text-secondary small">En proceso</div>
                <div className="h2 mb-0 text-info">{pendingCount}</div>
              </div>
            </div>
          </div>
          <div className="col-sm-4">
            <div className="card">
              <div className="card-body">
                <div className="text-secondary small">Activas</div>
                <div className="h2 mb-0 text-success">{activeCount}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger">
          <p className="mb-0">{error.message}</p>
          {error.auth ? (
            <Link
              to="/dev/login"
              state={{ from: '/dev/mis-solicitudes' }}
              className="btn btn-primary btn-sm mt-3"
            >
              Iniciar sesión
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <div className="card-body text-center text-secondary py-5">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
            Cargando solicitudes…
          </div>
        </div>
      ) : error ? null : listaSolicitudes.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5 px-4">
            <h2 className="h4 mb-3">No tienes solicitudes todavía</h2>
            <p className="text-secondary mb-4">
              Crea tu primera solicitud para integrar tu sistema con la API blockchain de Nexum.
            </p>
            <Link to="/dev/solicitud" className="btn btn-primary">
              Crear solicitud
            </Link>
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
                  <th>Estado</th>
                  <th>Actualización</th>
                  <th>Próximo paso</th>
                  <th className="w-1" />
                </tr>
              </thead>
              <tbody>
                {listaSolicitudes.map((s) => {
                  const meta = DEV_STATUS_META[s.status as DevRequestStatus] ?? DEV_STATUS_META.draft
                  const fecha = formatDevRequestDate(s.updatedAt ?? s.createdAt)
                  return (
                    <tr key={s.id}>
                      <td className="fw-medium">{s.orgName}</td>
                      <td className="font-monospace small">{s.tenantId}</td>
                      <td>
                        <DevRequestStatusBadge status={s.status} />
                      </td>
                      <td className="text-secondary small">{fecha ?? '—'}</td>
                      <td className="text-secondary small">{meta.nextStep}</td>
                      <td className="text-end">
                        <Link to={`/dev/estado/${s.id}`} className="btn btn-sm btn-outline-primary">
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {listaSolicitudes.length > 0 ? (
        <div className="d-flex flex-wrap gap-2 mt-3">
          <Link to="/dev/solicitud" className="btn btn-primary btn-sm">
            Nueva solicitud
          </Link>
          <Link to="/dev" className="btn btn-outline-secondary btn-sm">
            Volver al portal
          </Link>
        </div>
      ) : null}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DevRequestFlowTimeline,
  DevRequestStatusBadge,
  formatDevRequestDate,
  INTEGRATOR_PREVIEW_VIEW,
} from '../components/dev/DevRequestStatusUi'
import type { DevRequestStatus, DevTenantRequest } from '../services/devPortalApi'
import { getSolicitudPlataforma } from '../services/platformApi'

export default function PlatformRequestIntegratorPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [solicitud, setSolicitud] = useState<DevTenantRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const s = await getSolicitudPlataforma(id)
      setSolicitud(s)
    } catch (e) {
      setSolicitud(null)
      setError(e instanceof Error ? e.message : 'No se pudo cargar la solicitud.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <div className="container-xl py-5 text-center text-secondary">Cargando vista previa…</div>
  }

  if (!solicitud) {
    return (
      <div className="container-xl py-5">
        <div className="alert alert-danger">{error ?? 'Solicitud no encontrada.'}</div>
        <Link to="/admin/solicitudes" className="btn btn-outline-primary">
          ← Volver a solicitudes
        </Link>
      </div>
    )
  }

  const status = solicitud.status as DevRequestStatus
  const integratorView =
    INTEGRATOR_PREVIEW_VIEW[status] ?? INTEGRATOR_PREVIEW_VIEW.draft
  const fecha = formatDevRequestDate(solicitud.updatedAt ?? solicitud.createdAt)

  return (
    <div className="container-xl py-4">
      <Link to={`/admin/solicitudes/${solicitud.id}`} className="btn btn-ghost-secondary btn-sm mb-3">
        ← Volver a detalle operador
      </Link>

      <div className="alert alert-warning mb-4" role="status">
        <strong>Vista previa de operador:</strong> esta pantalla muestra cómo se presentará el estado de
        la solicitud al integrador. No inicia sesión como dev ni expone credenciales sensibles.
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h2 className="card-title">Resumen de solicitud</h2>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="text-secondary small">Organización</div>
              <div className="fw-semibold">{solicitud.orgName}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Tenant ID</div>
              <div className="font-monospace">{solicitud.tenantId}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Estado</div>
              <div className="mt-1">
                <DevRequestStatusBadge status={solicitud.status} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">ID de solicitud</div>
              <div className="font-monospace small text-break">{solicitud.id}</div>
            </div>
            {fecha ? (
              <div className="col-md-6">
                <div className="text-secondary small">Última actualización</div>
                <div>{fecha}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Flujo de integración</h3>
        </div>
        <div className="card-body">
          <DevRequestFlowTimeline status={solicitud.status} />
        </div>
      </div>

      <div className="alert alert-primary mb-4" role="status">
        <h4 className="alert-heading h5 mb-2">Qué verá el integrador</h4>
        <p className="mb-0">{integratorView}</p>
      </div>

      {status === 'rejected' && solicitud.rejectReason ? (
        <div className="alert alert-danger mb-4" role="alert">
          <h4 className="alert-heading h5 mb-2">Motivo de rechazo (visible para el integrador)</h4>
          <p className="mb-0">{solicitud.rejectReason}</p>
        </div>
      ) : null}

      <div className="card bg-light">
        <div className="card-body">
          <p className="text-secondary small mb-3">
            Las credenciales reales (API keys y contraseñas de consola) solo se muestran al integrador
            autenticado en el Portal Integrador. Desde esta Consola Operador puedes revisarlas en el
            detalle de la solicitud.
          </p>
          <Link to={`/admin/solicitudes/${solicitud.id}`} className="btn btn-outline-primary">
            Volver a detalle operador
          </Link>
        </div>
      </div>
    </div>
  )
}

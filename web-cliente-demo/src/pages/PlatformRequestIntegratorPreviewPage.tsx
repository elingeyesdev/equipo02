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

function FieldItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="operador-field-label">{label}</div>
      <div className={`operador-field-value${mono ? ' operador-field-value--mono' : ''}`}>{value}</div>
    </div>
  )
}

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
    return <div className="operador-page operador-loading">Cargando vista previa…</div>
  }

  if (!solicitud) {
    return (
      <div className="operador-page">
        <div className="operador-notice operador-notice--danger">{error ?? 'Solicitud no encontrada.'}</div>
        <Link to="/admin/solicitudes" className="operador-btn-outline">
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
    <div className="operador-page">
      <Link to={`/admin/solicitudes/${solicitud.id}`} className="operador-back-link">
        ← Volver a detalle operador
      </Link>

      <div className="operador-detail-header">
        <div className="operador-detail-title-row">
          <h1 className="operador-detail-title">Vista previa del integrador</h1>
          <DevRequestStatusBadge status={solicitud.status} />
        </div>
        <div className="operador-detail-meta">
          <span>{solicitud.orgName}</span>
          <span>
            tenant_id: <code>{solicitud.tenantId}</code>
          </span>
        </div>
      </div>

      <div className="operador-preview-banner" role="status">
        <strong>Vista previa de operador:</strong> esta pantalla muestra cómo se presentará el estado de la
        solicitud al integrador. No inicia sesión como dev ni expone credenciales sensibles.
      </div>

      <section className="operador-section">
        <div className="operador-section-header">
          <h2 className="operador-section-title">Resumen de solicitud</h2>
        </div>
        <div className="operador-section-body">
          <div className="operador-field-grid">
            <FieldItem label="Organización" value={solicitud.orgName} />
            <FieldItem label="Tenant ID" value={solicitud.tenantId} mono />
            <div>
              <div className="operador-field-label">Estado</div>
              <DevRequestStatusBadge status={solicitud.status} />
            </div>
            <FieldItem label="ID de solicitud" value={solicitud.id} mono />
            {fecha ? <FieldItem label="Última actualización" value={fecha} /> : null}
          </div>
        </div>
      </section>

      <section className="operador-section">
        <div className="operador-section-header">
          <h2 className="operador-section-title">Flujo de integración</h2>
        </div>
        <div className="operador-section-body">
          <DevRequestFlowTimeline status={solicitud.status} />
        </div>
      </section>

      <div className="operador-preview-callout" role="status">
        <h3 className="operador-preview-callout-title">Qué verá el integrador</h3>
        <p className="operador-preview-callout-text">{integratorView}</p>
      </div>

      {status === 'rejected' && solicitud.rejectReason ? (
        <div className="operador-notice operador-notice--danger mb-4" role="alert">
          <strong>Motivo de rechazo (visible para el integrador)</strong>
          <br />
          {solicitud.rejectReason}
        </div>
      ) : null}

      <div className="operador-preview-footer">
        <p className="operador-preview-footer-text">
          Las credenciales reales (API keys y contraseñas de consola) solo se muestran al integrador autenticado en
          el Portal Integrador. Desde esta Consola Operador puedes revisarlas en el detalle de la solicitud.
        </p>
        <Link to={`/admin/solicitudes/${solicitud.id}`} className="operador-btn-outline">
          Volver a detalle operador
        </Link>
      </div>
    </div>
  )
}

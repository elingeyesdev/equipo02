import type { DevRequestStatus } from '../../services/devPortalApi'

export type DevStatusMeta = {
  label: string
  badgeClass: string
  nextStep: string
  actionNow: string
}

export const DEV_STATUS_META: Record<DevRequestStatus, DevStatusMeta> = {
  draft: {
    label: 'Borrador',
    badgeClass: 'bg-secondary',
    nextStep: 'Completa y envía la solicitud.',
    actionNow: 'Completa la información requerida y envía la solicitud.',
  },
  pending: {
    label: 'En revisión',
    badgeClass: 'bg-warning',
    nextStep: 'Espera la revisión del operador BaaS.',
    actionNow:
      'Tu solicitud fue enviada correctamente. El operador BaaS debe revisarla antes de generar las credenciales.',
  },
  provisioning: {
    label: 'En provisioning',
    badgeClass: 'bg-info',
    nextStep: 'El operador está configurando tu tenant.',
    actionNow:
      'Tu tenant está siendo configurado. Cuando finalice el proceso, podrás ver tus credenciales aquí.',
  },
  active: {
    label: 'Activo',
    badgeClass: 'bg-success',
    nextStep: 'Tu tenant está activo. Revisa tus credenciales.',
    actionNow: 'Tu tenant ya está activo. Copia tus credenciales y conecta tu backend con Nexum.',
  },
  rejected: {
    label: 'Rechazado',
    badgeClass: 'bg-danger',
    nextStep: 'Revisa el motivo de rechazo.',
    actionNow: 'Tu solicitud fue rechazada. Revisa el motivo y crea una nueva solicitud si corresponde.',
  },
}

/** Próximo paso para la cola del operador BaaS. */
export const OPERATOR_NEXT_STEP: Record<DevRequestStatus, string> = {
  draft: 'Esperando envío',
  pending: 'Revisar y decidir',
  provisioning: 'Completar configuración',
  active: 'Tenant operativo',
  rejected: 'Solicitud finalizada',
}

/** Texto para vista previa del operador: qué verá el integrador en el Portal Integrador. */
export const INTEGRATOR_PREVIEW_VIEW: Record<DevRequestStatus, string> = {
  draft: 'El integrador verá un borrador pendiente de completar y enviar.',
  pending: 'El integrador verá que su solicitud está en revisión.',
  provisioning: 'El integrador verá que su tenant está siendo configurado.',
  active:
    'El integrador verá que el tenant está activo y podrá consultar sus credenciales desde el Portal Integrador.',
  rejected: 'El integrador verá el motivo de rechazo.',
}

const FLOW_STEPS = [
  'Solicitud enviada',
  'Revisión del operador',
  'Provisioning del tenant',
  'Tenant activo',
  'Credenciales disponibles',
] as const

type StepState = 'done' | 'current' | 'pending' | 'rejected'

function flowStepStates(status: DevRequestStatus): StepState[] {
  switch (status) {
    case 'draft':
      return ['current', 'pending', 'pending', 'pending', 'pending']
    case 'pending':
      return ['done', 'current', 'pending', 'pending', 'pending']
    case 'provisioning':
      return ['done', 'done', 'current', 'pending', 'pending']
    case 'active':
      return ['done', 'done', 'done', 'done', 'done']
    case 'rejected':
      return ['done', 'done', 'rejected', 'pending', 'pending']
    default:
      return ['pending', 'pending', 'pending', 'pending', 'pending']
  }
}

export function formatDevRequestDate(iso?: string): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function DevRequestStatusBadge({ status }: { status: DevRequestStatus | string }) {
  const meta = DEV_STATUS_META[status as DevRequestStatus] ?? DEV_STATUS_META.draft
  return <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
}

export function DevRequestFlowTimeline({ status }: { status: DevRequestStatus | string }) {
  const states = flowStepStates(status as DevRequestStatus)

  return (
    <div className="dev-flow-timeline">
      <div className="row g-2">
        {FLOW_STEPS.map((label, i) => {
          const state = states[i]
          const dotClass =
            state === 'done'
              ? 'bg-success'
              : state === 'current'
                ? 'bg-primary'
                : state === 'rejected'
                  ? 'bg-danger'
                  : 'bg-secondary-lt border'
          const textClass =
            state === 'done'
              ? 'text-success fw-semibold'
              : state === 'current'
                ? 'text-primary fw-semibold'
                : state === 'rejected'
                  ? 'text-danger fw-semibold'
                  : 'text-secondary'

          return (
            <div key={label} className="col-6 col-md">
              <div className="text-center p-3 rounded border bg-white h-100">
                <div
                  className={`rounded-circle mx-auto mb-2 ${dotClass}`}
                  style={{ width: '0.75rem', height: '0.75rem' }}
                  aria-hidden
                />
                <p className={`small mb-0 ${textClass}`}>
                  {state === 'rejected' ? 'Rechazado' : label}
                </p>
                {state === 'current' ? (
                  <span className="badge bg-primary-lt text-primary mt-2">En curso</span>
                ) : null}
                {state === 'done' ? (
                  <span className="badge bg-success-lt text-success mt-2">Completado</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function formatSolicitudLoadError(e: unknown): { kind: '403' | '404' | 'network' | 'other'; message: string } {
  if (e instanceof TypeError) {
    return {
      kind: 'network',
      message: 'No se pudo conectar con el servidor. Verifica que web-portal-api esté activo.',
    }
  }
  if (e instanceof Error) {
    const lower = e.message.toLowerCase()
    if (lower.includes('http 403') || lower.includes('acceso') || lower.includes('no tienes acceso')) {
      return {
        kind: '403',
        message:
          'No tienes permiso para ver esta solicitud. Inicia sesión con la misma cuenta que la envió.',
      }
    }
    if (lower.includes('http 404') || lower.includes('no encontrada')) {
      return { kind: '404', message: 'Solicitud no encontrada.' }
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return {
        kind: 'network',
        message: 'No se pudo conectar con el servidor. Verifica que web-portal-api esté activo.',
      }
    }
    return { kind: 'other', message: e.message }
  }
  return { kind: 'other', message: 'Error al cargar la solicitud.' }
}

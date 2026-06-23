import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { etiquetaOrganizacion } from '../lib/organizacion'
import { rolePermissions } from '../lib/roles'
import type { AppRole } from '../types/demo'

function descripcionRol(role: AppRole): string {
  if (role === 'admin') {
    return 'Puede registrar datos, aprobar solicitudes, auditar y gestionar operaciones del tenant.'
  }
  if (role === 'integrador') {
    return 'Puede enviar operaciones desde el sistema cliente y proponer cambios que pueden requerir aprobación.'
  }
  return 'Puede consultar datos e historial en cadena sin modificar información.'
}

/**
 * Página "Perfil y permisos". Muestra identidad, rol y capacidades de la sesión JWT.
 */
export default function CredencialesPage() {
  const { role, roleLabel, tenant, nombreUsuario } = useSettings()
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const perms = rolePermissions(role)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-2">
      <section className="admin-card p-5">
        <h2 className="admin-card-title">Sesión actual</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile label="Usuario" value={usuario?.usuario ?? '—'} tone="info" help="Identificador para iniciar sesión." />
          <StatusTile label="Nombre" value={nombreUsuario || '—'} tone="ok" help="Tal como lo registró el operador del BaaS." />
          <StatusTile
            label="Tenant"
            value={etiquetaOrganizacion(tenant)}
            tone="info"
            help="Organización o espacio de datos de tu cuenta."
          />
          <StatusTile label="Rol" value={roleLabel} tone="ok" help="Determina qué acciones puedes realizar en la consola." />
        </div>
      </section>

      <section className="admin-card p-5">
        <h2 className="admin-card-title">Qué puede hacer tu rol</h2>
        <p className="mt-2 text-sm text-ink-secondary">{descripcionRol(role)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <PermChip ok={perms.canConsultClients} text="Consultar datos" />
          <PermChip ok={perms.canViewHistory} text="Ver actividad e historial" />
          <PermChip ok={perms.canSeeAdminNotifications} text="Recibir notificaciones admin" />
        </div>
      </section>

      <section className="admin-card p-5">
        <h2 className="admin-card-title">Cómo se autentica esta consola</h2>
        <p className="mt-2 text-xs text-muted">
          La Consola Cliente <strong>no</strong> guarda una <code className="font-mono">X-API-Key</code> en el
          navegador. El login emite un JWT que enviamos en cada petición; el BFF (
          <code className="font-mono">web-portal-api</code>) lo valida, deduce el tenant y rol del usuario, e inyecta
          la <code className="font-mono">X-API-Key</code> real más las cabeceras{' '}
          <code className="font-mono">X-Actor-*</code> al reenviar la petición al{' '}
          <code className="font-mono">api-middleware</code>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Las cuentas humanas las administra el operador del BaaS editando{' '}
          <code className="font-mono">web-portal-api/config/usuarios-admin.yaml</code> y reiniciando el BFF.
        </p>
      </section>

      <section className="admin-card p-5">
        <h2 className="admin-card-title">Cerrar sesión</h2>
        <p className="mt-2 text-xs text-muted">
          Al salir, el JWT actual se invalida en el BFF y se borra del navegador.
        </p>
        <button
          type="button"
          className="mt-4 rounded-md border border-danger/35 bg-danger-soft px-4 py-2 text-sm font-semibold text-danger-ink hover:bg-danger-soft/80"
          onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
        >
          Cerrar sesión
        </button>
      </section>
    </div>
  )
}

function StatusTile({
  label,
  value,
  help,
  tone,
}: {
  label: string
  value: string
  help: string
  tone: 'ok' | 'warn' | 'info'
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-success/30 bg-success-soft'
      : tone === 'warn'
        ? 'border-warning/35 bg-warning-soft'
        : 'border-accent/25 bg-accent-soft'
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{help}</p>
    </div>
  )
}

function PermChip({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={[
        'rounded-full border px-2.5 py-1 text-[11px]',
        ok ? 'border-success/35 bg-success-soft text-success-ink' : 'border-line bg-gray-50 text-muted',
      ].join(' ')}
    >
      {ok ? 'Sí' : 'No'} · {text}
    </span>
  )
}

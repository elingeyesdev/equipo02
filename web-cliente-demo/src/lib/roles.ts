import type { AppRole } from '../types/demo'

/**
 * Permisos efectivos del rol en la Consola BaaS (frontend único).
 *
 * El rol del backend (admin / integrador / solo_lectura) determina las
 * acciones disponibles: admin escribe y aprueba; integrador propone cambios
 * (quedan pendientes de aprobación); solo_lectura solo consulta.
 */
export interface RolePermissions {
  canConsultClients: boolean
  canViewHistory: boolean
  /** Solo admin recibe notificaciones del feed administrativo. */
  canSeeAdminNotifications: boolean
}

export type AppRoutePath =
  | '/app'
  | '/app/datos'
  | '/app/datos-registrados'
  | '/app/consultas'
  | '/app/solicitudes'
  | '/app/auditoria'
  | '/app/historial-dato'
  | '/app/historial'
  | '/app/credenciales'

/** Convierte el rol del backend (admin|integrador|lectura) al alias usado en la UI. */
export function roleFromBackend(rol: string | undefined | null): AppRole {
  switch ((rol ?? '').toLowerCase().trim()) {
    case 'admin':
      return 'admin'
    case 'integrador':
      return 'integrador'
    case 'lectura':
    case 'solo_lectura':
      return 'solo_lectura'
    default:
      return 'solo_lectura'
  }
}

export function roleLabel(role: AppRole): string {
  if (role === 'admin') return 'Administrador'
  if (role === 'integrador') return 'Integrador'
  return 'Solo lectura'
}

export function workspaceLabel(role: AppRole): string {
  if (role === 'admin') return 'Administración del tenant'
  if (role === 'integrador') return 'Operaciones del integrador'
  return 'Consulta del tenant'
}

/**
 * Todos los roles con sesión tienen acceso a las páginas de lectura del
 * puente. La diferencia es que solo `admin` recibe notificaciones en
 * vivo del feed administrativo.
 */
export function rolePermissions(role: AppRole): RolePermissions {
  return {
    canConsultClients: true,
    canViewHistory: true,
    canSeeAdminNotifications: role === 'admin',
  }
}

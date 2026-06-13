import type { AppRole } from '../types/demo'

/**
 * Permisos efectivos del rol en la CONSOLA del puente (audit-only).
 *
 * Importante: el `web-cliente-demo` es explorer; las altas y ediciones de
 * clientes se realizan en el portal del cliente (`web-portal-cliente`) o
 * directamente vía API. Los permisos de escritura del rol siguen
 * vigentes en el `api-middleware`, pero ya no se exponen botones de
 * escritura en esta UI.
 */
export interface RolePermissions {
  canConsultClients: boolean
  canViewHistory: boolean
  canViewTraceability: boolean
  /** Solo admin recibe notificaciones del feed administrativo. */
  canSeeAdminNotifications: boolean
}

export type AppRoutePath =
  | '/app'
  | '/app/clientes-registrados'
  | '/app/consultas'
  | '/app/auditoria'
  | '/app/historial-cliente'
  | '/app/historial'
  | '/app/trazabilidad'
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
  if (role === 'admin') return 'Panel del puente'
  if (role === 'integrador') return 'Explorador del puente'
  return 'Consulta del puente'
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
    canViewTraceability: true,
    canSeeAdminNotifications: role === 'admin',
  }
}

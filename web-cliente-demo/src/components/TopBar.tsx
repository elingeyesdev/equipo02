import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconRefresh } from '@tabler/icons-react'
import { useAppShell } from '../context/AppShellContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { etiquetaOrganizacion } from '../lib/organizacion'
import { workspaceLabel } from '../lib/roles'
import { NotificacionesAdminPanel } from './NotificacionesAdminPanel'

interface TopBarProps {
  onMenuClick: () => void
}

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  '/app': {
    title: 'Panel de la Consola Cliente',
    subtitle: 'Resumen operativo del tenant',
  },
  '/app/datos': {
    title: 'Actualización manual',
    subtitle: 'Actualiza o da de baja registros existentes enviados desde el sistema cliente',
  },
  '/app/datos-registrados': {
    title: 'Datos registrados',
    subtitle: 'Inventario de registros del tenant en la red blockchain',
  },
  '/app/consultas': {
    title: 'Consultar registro',
    subtitle: 'Busca un registro por ID para revisar su estado actual en Nexum',
  },
  '/app/solicitudes': {
    title: 'Cola de aprobación',
    subtitle: 'Solicitudes de cambio de datos dentro del tenant',
  },
  '/app/auditoria': {
    title: 'Auditoría',
    subtitle:
      'Eventos y operaciones registradas del tenant. Para el historial on-chain de un dato, usa Consultar registro o Historial en cadena.',
  },
  '/app/historial': {
    title: 'Historial local de sesión',
    subtitle: 'Acciones registradas solo en este navegador durante la sesión actual',
  },
  '/app/credenciales': {
    title: 'Perfil y permisos',
    subtitle: 'Usuario, tenant, rol y capacidades de tu sesión',
  },
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'sin registrar'
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins === 1) return 'hace 1 min'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours === 1) return 'hace 1 h'
  return `hace ${hours} h`
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { panelToolbar } = useAppShell()
  const { mode, role, roleLabel, tenant, nombreUsuario } = useSettings()
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const esPanel = pathname === '/app'
  const workspace = workspaceLabel(role)
  const nombre = nombreUsuario || usuario?.usuario || 'Sin sesión'
  const tenantLabel = tenant ? etiquetaOrganizacion(tenant) : 'Tenant actual'

  const meta = useMemo(() => {
    if (pathname.startsWith('/app/historial-dato')) {
      return {
        title: 'Historial en cadena',
        subtitle: 'Revisiones on-chain de un registro específico',
      }
    }
    return SECTION_META[pathname] ?? SECTION_META['/app']
  }, [pathname])

  const subtitle = esPanel ? `${tenantLabel} · ${workspace}` : meta.subtitle

  return (
    <header className="consola-topbar flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          className="rounded-md p-2 text-muted hover:bg-gray-100 hover:text-ink lg:hidden"
          aria-label="Abrir menú"
          onClick={onMenuClick}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="consola-topbar-eyebrow">Nexum</p>
          <h1 className="consola-topbar-title truncate">{meta.title}</h1>
          <p className="consola-topbar-subtitle truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {esPanel && panelToolbar ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="consola-refresh-btn"
              title="Actualizar datos"
              aria-label="Actualizar datos"
              disabled={panelToolbar.refreshing}
              onClick={() => void panelToolbar.onRefresh()}
            >
              <IconRefresh
                size={18}
                stroke={1.75}
                className={panelToolbar.refreshing ? 'animate-spin' : undefined}
              />
            </button>
            <span className="consola-refresh-meta hidden lg:inline">
              Última actualización: {formatRelativeTime(panelToolbar.lastUpdated)}
            </span>
          </div>
        ) : null}

        <span className={`consola-chip ${mode === 'api' ? 'consola-chip--api' : ''}`}>
          {mode === 'api' ? 'API' : 'Sin API'}
        </span>
        <span className="consola-chip consola-chip--role hidden sm:inline-flex">{roleLabel}</span>

        <NotificacionesAdminPanel />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className="consola-user-avatar-btn"
            title={nombre}
            aria-label={`Menú de ${nombre}`}
          >
            <span className="consola-user-avatar">{iniciales(nombre)}</span>
          </button>
          {menuAbierto ? (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuAbierto(false)} aria-hidden />
              <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-card-md">
                <div className="border-b border-line bg-gray-50 px-3 py-2 text-xs">
                  <p className="truncate font-semibold text-ink">{nombre}</p>
                  <p className="truncate text-muted">{usuario?.usuario}</p>
                </div>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs text-ink-secondary hover:bg-gray-50"
                  onClick={() => {
                    setMenuAbierto(false)
                    navigate('/app/credenciales')
                  }}
                >
                  Perfil y permisos
                </button>
                <button
                  type="button"
                  className="block w-full border-t border-line px-3 py-2 text-left text-xs text-danger hover:bg-danger-soft"
                  onClick={() => {
                    setMenuAbierto(false)
                    void logout().then(() => navigate('/login', { replace: true }))
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}

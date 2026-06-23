import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
    subtitle: 'Resumen del tenant, accesos rápidos y datos registrados',
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
    subtitle: 'Búsqueda por datoId o TxID con historial y evidencia',
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

export function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { mode, role, roleLabel, tenant, nombreUsuario } = useSettings()
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const workspace = workspaceLabel(role)
  const nombre = nombreUsuario || usuario?.usuario || 'Sin sesión'
  const meta = useMemo(() => {
    if (pathname.startsWith('/app/historial-dato')) {
      return {
        title: 'Historial en cadena',
        subtitle: 'Revisiones on-chain de un registro específico',
      }
    }
    return SECTION_META[pathname] ?? SECTION_META['/app']
  }, [pathname])

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 shadow-sm sm:gap-4 sm:px-6">
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
          <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#1a3a5c]">Nexum</p>
          <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-lg">{meta.title}</h1>
          <p className="hidden truncate text-xs text-muted sm:block">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div
          className={`hidden rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:block ${
            mode === 'api' ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-gray-50 text-muted'
          }`}
        >
          {mode === 'api' ? 'API' : 'Sin API'}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {tenant ? (
            <span className="rounded-md border border-line bg-gray-50 px-3 py-1 text-xs font-medium text-ink-secondary">
              Organización: <span className="text-ink">{etiquetaOrganizacion(tenant)}</span>
            </span>
          ) : null}
          <span className="rounded-md border border-line bg-gray-50 px-3 py-1 text-xs font-medium text-ink-secondary">
            Rol: <span className="font-semibold text-accent">{roleLabel}</span>
          </span>
          <span className="rounded-md border border-line bg-gray-50 px-3 py-1 text-xs font-medium text-ink-secondary">
            Espacio: <span className="text-ink">{workspace}</span>
          </span>
          <NotificacionesAdminPanel />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-line bg-gray-50 px-2 py-1 pr-3 hover:bg-gray-100"
              title={nombre}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                {iniciales(nombre)}
              </span>
              <span className="max-w-[140px] truncate text-xs font-medium text-ink">{nombre}</span>
            </button>
            {menuAbierto ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuAbierto(false)} aria-hidden />
                <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-md border border-line bg-surface shadow-card-md">
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
      </div>
    </header>
  )
}

import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useAppShell } from '../context/AppShellContext'
import type { AppRoutePath } from '../lib/roles'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

type NavItem = {
  to: AppRoutePath
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

const items: NavItem[] = [
  { to: '/app', label: 'Panel', icon: IconGrid, end: true },
  { to: '/app/datos', label: 'Actualización manual', icon: IconPencil },
  { to: '/app/datos-registrados', label: 'Datos registrados', icon: IconList },
  { to: '/app/consultas', label: 'Consultar registro', icon: IconSearch },
  { to: '/app/solicitudes', label: 'Cola de aprobación', icon: IconInbox },
  { to: '/app/auditoria', label: 'Auditoría', icon: IconShield },
  { to: '/app/credenciales', label: 'Perfil y permisos', icon: IconKey },
]

const LOGO = '/logo_icono_sinfondo.png'

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useAppShell()
  const collapsed = sidebarCollapsed

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Cerrar menú"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={[
          'consola-sidebar fixed z-40 flex h-full shrink-0 flex-col text-white shadow-card-md transition-transform lg:static',
          collapsed ? 'consola-sidebar--collapsed' : 'consola-sidebar--expanded',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="consola-sidebar-brand">
          <NavLink to="/app" end className="flex min-w-0 items-center gap-2" onClick={onCloseMobile} title="Panel">
            <img src={LOGO} alt="Nexum" className="consola-sidebar-logo" height={28} />
            <div className="consola-sidebar-brand-text">
              <span className="text-sm font-bold uppercase tracking-[0.08em] text-white">Nexum</span>
              <p className="consola-sidebar-subtitle">Consola Cliente</p>
            </div>
          </NavLink>
        </div>

        <nav className="consola-sidebar-nav" aria-label="Navegación principal">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              title={it.label}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                ['consola-sidebar-link', isActive ? 'consola-sidebar-link--active' : ''].filter(Boolean).join(' ')
              }
            >
              <it.icon className="consola-sidebar-link-icon" />
              <span className="consola-sidebar-link-label">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="consola-sidebar-foot">
          {collapsed ? (
            <div
              className="consola-sidebar-fabric consola-sidebar-fabric--compact"
              title="Hyperledger Fabric · Conexión activa vía middleware"
            >
              <span className="consola-sidebar-fabric-dot" aria-hidden />
            </div>
          ) : (
            <div className="consola-sidebar-fabric">
              <p className="mb-0 text-[0.68rem] font-semibold uppercase tracking-wide text-white/45">Conexión</p>
              <p className="mb-0 mt-1 text-sm font-medium text-white">Hyperledger Fabric</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="consola-sidebar-fabric-dot" aria-hidden />
                <span className="text-xs text-white/55">Activa vía middleware</span>
              </div>
            </div>
          )}
          <button
            type="button"
            className="consola-sidebar-toggle hidden lg:flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <IconChevronRight size={18} stroke={1.75} /> : <IconChevronLeft size={18} stroke={1.75} />}
          </button>
        </div>
      </aside>
    </>
  )
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

function IconInbox({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  )
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25z" />
    </svg>
  )
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
      />
    </svg>
  )
}

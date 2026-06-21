import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import type { AppRoutePath } from '../lib/roles'
import { useSettings } from '../context/SettingsContext'

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

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { tenant } = useSettings()
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'
  const items: NavItem[] = [
    { to: '/app', label: 'Panel', icon: IconGrid, end: true },
    { to: '/app/datos', label: 'Datos', icon: IconList },
    { to: '/app/clientes-registrados', label: isAgricultura ? 'Registros en red' : 'Explorador', icon: IconList },
    { to: '/app/consultas', label: isAgricultura ? 'Detalle de registro' : 'Consultas', icon: IconSearch },
    { to: '/app/solicitudes', label: 'Aprobaciones', icon: IconInbox },
    { to: '/app/auditoria', label: 'Auditar', icon: IconShield },
    { to: '/app/historial', label: 'Historial', icon: IconClock },
    { to: '/app/trazabilidad', label: 'Trazabilidad', icon: IconFlow },
    { to: '/app/credenciales', label: 'Perfil', icon: IconKey },
  ]
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
          'fixed z-40 flex h-full w-64 shrink-0 flex-col bg-sidebar text-white shadow-card-md transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <NavLink to="/app" end className="block" onClick={onCloseMobile}>
            <span className="text-xl font-bold uppercase tracking-[0.08em] text-white">Nexum</span>
            <p className="mt-1 text-xs text-white/55">Consola BaaS universal</p>
          </NavLink>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                [
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-active font-medium text-white'
                    : 'text-white/75 hover:bg-sidebar-hover hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-white/70'}`} />
                  <span>{it.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-medium text-white/60">Conexión</p>
            <p className="mt-1 text-sm font-medium text-white">Hyperledger Fabric</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs text-white/60">Estado vía middleware</span>
            </div>
          </div>
        </div>
      </aside>
    </>
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

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconFlow({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h6m9 0h-3m-3 0h-3m6 0v3m0 4.5v3m0-3h3m-6 0h3m-12 0h6m-6 0v-3m0-4.5v-3m0 3h3m6 0h0" />
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


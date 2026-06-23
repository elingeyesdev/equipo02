import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ToastStack } from '../components/ToastStack'
import { TopBar } from '../components/TopBar'

/**
 * Shell de la consola tenant (/app): sidebar fijo + cabecera + área con scroll.
 * Mantiene la estructura flex que necesitan Panel, Auditar, etc.
 */
export function TablerAppLayout() {
  const [mobileNav, setMobileNav] = useState(false)

  return (
    <div className="app-shell flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-canvas text-ink">
      <Sidebar mobileOpen={mobileNav} onCloseMobile={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileNav(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastStack />
    </div>
  )
}

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ToastStack } from '../components/ToastStack'
import { TopBar } from '../components/TopBar'
import { AppShellProvider } from '../context/AppShellContext'

/**
 * Shell de la consola tenant (/app): sidebar expandible + cabecera + área con scroll.
 */
export function TablerAppLayout() {
  const [mobileNav, setMobileNav] = useState(false)

  return (
    <AppShellProvider>
      <div className="app-shell flex h-[100dvh] max-h-[100dvh] overflow-hidden text-ink">
        <Sidebar mobileOpen={mobileNav} onCloseMobile={() => setMobileNav(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar onMenuClick={() => setMobileNav(true)} />
          <main className="consola-main flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-7">
            <div className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col">
              <Outlet />
            </div>
          </main>
        </div>
        <ToastStack />
      </div>
    </AppShellProvider>
  )
}

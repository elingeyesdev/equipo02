import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type PanelToolbarState = {
  onRefresh: () => void
  refreshing: boolean
  lastUpdated: Date | null
}

type AppShellValue = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  panelToolbar: PanelToolbarState | null
  setPanelToolbar: (toolbar: PanelToolbarState | null) => void
}

const AppShellContext = createContext<AppShellValue | null>(null)

const SIDEBAR_KEY = 'nexum.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(readCollapsed)
  const [panelToolbar, setPanelToolbar] = useState<PanelToolbarState | null>(null)

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedState(v)
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed)
  }, [sidebarCollapsed, setSidebarCollapsed])

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed,
      panelToolbar,
      setPanelToolbar,
    }),
    [sidebarCollapsed, toggleSidebar, setSidebarCollapsed, panelToolbar],
  )

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell debe usarse dentro de AppShellProvider')
  return ctx
}

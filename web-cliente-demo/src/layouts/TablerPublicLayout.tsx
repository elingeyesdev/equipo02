import { Outlet } from 'react-router-dom'

export function TablerPublicLayout() {
  return (
    <div className="page">
      <div className="page-wrapper">
        {/* Sin padding: cada vista pública define su propio contenedor (landing, login, onboarding). */}
        <div className="page-body p-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

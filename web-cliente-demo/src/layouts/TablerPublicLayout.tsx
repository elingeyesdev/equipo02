import { Outlet } from 'react-router-dom'

export function TablerPublicLayout() {
  return (
    <div className="page">
      <div className="page-wrapper">
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

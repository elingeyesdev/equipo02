import { Route, Navigate, Routes, useParams } from 'react-router-dom'
import { RequiereSesion } from './components/RequiereSesion'
import { DashboardLayout } from './layouts/DashboardLayout'
import DatoHistorialPage from './pages/DatoHistorialPage'
import DatosRegistradosPage from './pages/DatosRegistradosPage'
import CredencialesPage from './pages/CredencialesPage'
import ConsultasPage from './pages/ConsultasPage'
import HistorialPage from './pages/HistorialPage'
import AuditarPage from './pages/AuditarPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DatosPage from './pages/DatosPage'
import OnboardingTenantPage from './pages/OnboardingTenantPage'
import PanelPage from './pages/PanelPage'
import SolicitudesPage from './pages/SolicitudesPage'
import TrazabilidadPage from './pages/TrazabilidadPage'

/**
 * Consola BaaS: frontend ÚNICO del proyecto. Modelo universal `/datos`,
 * bandeja de aprobaciones, auditoría, historial, trazabilidad y onboarding.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingTenantPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <RequiereSesion>
            <DashboardLayout />
          </RequiereSesion>
        }
      >
        <Route index element={<PanelPage />} />
        <Route path="datos" element={<DatosPage />} />
        <Route path="consultas" element={<ConsultasPage />} />
        <Route path="solicitudes" element={<SolicitudesPage />} />
        <Route path="datos-registrados" element={<DatosRegistradosPage />} />
        <Route path="historial-dato/:datoId" element={<DatoHistorialPage />} />
        <Route path="historial" element={<HistorialPage />} />
        <Route path="auditoria" element={<AuditarPage />} />
        <Route path="trazabilidad" element={<TrazabilidadPage />} />
        <Route path="credenciales" element={<CredencialesPage />} />
        {/* Rutas legacy → redirigen al modelo universal */}
        <Route path="clientes-registrados" element={<Navigate to="/app/datos-registrados" replace />} />
        <Route path="historial-cliente/:clienteId" element={<RedirectHistorialLegacy />} />
      </Route>
    </Routes>
  )
}

function RedirectHistorialLegacy() {
  const { clienteId } = useParams()
  const id = encodeURIComponent(clienteId ?? '')
  return <Navigate to={`/app/historial-dato/${id}`} replace />
}

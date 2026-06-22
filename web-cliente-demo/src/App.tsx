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
import OnboardingOperatorPage from './pages/OnboardingOperatorPage'
import OnboardingTenantPage from './pages/OnboardingTenantPage'
import DevPortalChatPage from './pages/DevPortalChatPage'
import DevPortalStatusPage from './pages/DevPortalStatusPage'
import DevLoginPage from './pages/DevLoginPage'
import DevRegisterPage from './pages/DevRegisterPage'
import DevMisSolicitudesPage from './pages/DevMisSolicitudesPage'
import PlatformRequestsPage from './pages/PlatformRequestsPage'
import PlatformRequestDetailPage from './pages/PlatformRequestDetailPage'
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
      <Route path="/onboarding/operador" element={<OnboardingOperatorPage />} />
      <Route path="/dev" element={<DevPortalChatPage />} />
      <Route path="/dev/login" element={<DevLoginPage />} />
      <Route path="/dev/registro" element={<DevRegisterPage />} />
      <Route path="/dev/mis-solicitudes" element={<DevMisSolicitudesPage />} />
      <Route path="/dev/estado/:id" element={<DevPortalStatusPage />} />
      <Route path="/admin/solicitudes" element={<PlatformRequestsPage />} />
      <Route path="/admin/solicitudes/:id" element={<PlatformRequestDetailPage />} />
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

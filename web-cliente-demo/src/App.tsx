import { Route, Navigate, Routes, useParams } from 'react-router-dom'
import { RequiereDevAuth } from './components/RequiereDevAuth'
import { RequiereSesion } from './components/RequiereSesion'
import { TablerAppLayout } from './layouts/TablerAppLayout'
import { TablerAdminLayout } from './layouts/TablerAdminLayout'
import { TablerDevLayout } from './layouts/TablerDevLayout'
import { TablerPublicLayout } from './layouts/TablerPublicLayout'
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
import DevPortalDashboardPage from './pages/DevPortalDashboardPage'
import DevPortalSolicitudPage from './pages/DevPortalSolicitudPage'
import DevPortalStatusPage from './pages/DevPortalStatusPage'
import DevLoginPage from './pages/DevLoginPage'
import DevRegisterPage from './pages/DevRegisterPage'
import DevMisSolicitudesPage from './pages/DevMisSolicitudesPage'
import PlatformRequestsPage from './pages/PlatformRequestsPage'
import PlatformRequestDetailPage from './pages/PlatformRequestDetailPage'
import PlatformRequestIntegratorPreviewPage from './pages/PlatformRequestIntegratorPreviewPage'
import PanelPage from './pages/PanelPage'
import SolicitudesPage from './pages/SolicitudesPage'

export default function App() {
  return (
    <Routes>
      <Route element={<TablerPublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingTenantPage />} />
        <Route path="/onboarding/operador" element={<OnboardingOperatorPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route path="/dev" element={<TablerDevLayout />}>
        <Route index element={<DevPortalDashboardPage />} />
        <Route
          path="solicitud"
          element={
            <RequiereDevAuth
              title="Acceso requerido"
              message="Para crear una solicitud de integración debes iniciar sesión o registrarte."
            >
              <DevPortalSolicitudPage />
            </RequiereDevAuth>
          }
        />
        <Route
          path="asistente"
          element={
            <RequiereDevAuth
              title="Acceso requerido"
              message="Para usar el asistente de integración debes iniciar sesión. Así podremos asociar la solicitud a tu cuenta."
            >
              <DevPortalChatPage />
            </RequiereDevAuth>
          }
        />
        <Route path="login" element={<DevLoginPage />} />
        <Route path="registro" element={<DevRegisterPage />} />
        <Route
          path="mis-solicitudes"
          element={
            <RequiereDevAuth
              title="Acceso requerido"
              message="Para ver tus solicitudes debes iniciar sesión con tu cuenta integrador."
            >
              <DevMisSolicitudesPage />
            </RequiereDevAuth>
          }
        />
        <Route path="estado/:id" element={<DevPortalStatusPage />} />
      </Route>

      <Route path="/admin" element={<TablerAdminLayout />}>
        <Route path="solicitudes" element={<PlatformRequestsPage />} />
        <Route path="solicitudes/:id/preview-integrador" element={<PlatformRequestIntegratorPreviewPage />} />
        <Route path="solicitudes/:id" element={<PlatformRequestDetailPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <RequiereSesion>
            <TablerAppLayout />
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
        <Route path="trazabilidad" element={<Navigate to="/app/consultas" replace />} />
        <Route path="credenciales" element={<CredencialesPage />} />
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

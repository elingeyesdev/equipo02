import { Route, Routes } from 'react-router-dom'
import { RequiereSesion } from './components/RequiereSesion'
import { DashboardLayout } from './layouts/DashboardLayout'
import ClienteHistorialPage from './pages/ClienteHistorialPage'
import ClientesRegistradosPage from './pages/ClientesRegistradosPage'
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
 * Consola BaaS: frontend ÚNICO del proyecto. Permite el CRUD genérico de
 * /datos (modelo universal), la bandeja de aprobaciones, auditoría, historial,
 * trazabilidad, restauración y onboarding. El rol del usuario (admin /
 * integrador / solo_lectura) determina qué acciones puede ejecutar.
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
        <Route path="clientes-registrados" element={<ClientesRegistradosPage />} />
        <Route path="historial-cliente/:clienteId" element={<ClienteHistorialPage />} />
        <Route path="historial" element={<HistorialPage />} />
        <Route path="auditoria" element={<AuditarPage />} />
        <Route path="trazabilidad" element={<TrazabilidadPage />} />
        <Route path="credenciales" element={<CredencialesPage />} />
      </Route>
    </Routes>
  )
}

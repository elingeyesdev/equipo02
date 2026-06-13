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
import OnboardingTenantPage from './pages/OnboardingTenantPage'
import PanelPage from './pages/PanelPage'
import TrazabilidadPage from './pages/TrazabilidadPage'

/**
 * El web-cliente-demo es el "explorer" del puente: solo lectura.
 * Las altas/ediciones de clientes ocurren en el portal del cliente
 * (web-portal-cliente) o vía API directa al middleware. Aquí solo se
 * audita, consulta historial y se reciben notificaciones (rol admin).
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
        <Route path="consultas" element={<ConsultasPage />} />
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

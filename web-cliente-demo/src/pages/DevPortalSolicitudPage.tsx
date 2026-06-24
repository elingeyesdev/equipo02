import { Link } from 'react-router-dom'
import DevPortalFormWizard from './DevPortalFormWizard'
import '../dev-wizard.css'

export default function DevPortalSolicitudPage() {
  return (
    <div className="dev-wizard-page container-xl py-4">
      <div className="dev-wizard-header">
        <Link to="/dev" className="dev-wizard-back">
          ← Portal Integrador Nexum
        </Link>
        <h1 className="dev-wizard-title">Nueva solicitud de integración</h1>
        <p className="dev-wizard-lead">
          Completa los datos necesarios para que Nexum evalúe tu organización y prepare tu tenant.
        </p>
      </div>
      <DevPortalFormWizard />
    </div>
  )
}

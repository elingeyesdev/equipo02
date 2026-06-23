import { Link } from 'react-router-dom'
import DevPortalFormWizard from './DevPortalFormWizard'

export default function DevPortalSolicitudPage() {
  return (
    <div className="container-xl py-4">
      <div className="mb-4">
        <Link to="/dev" className="btn btn-ghost-secondary btn-sm mb-2">
          ← Portal Integrador Nexum
        </Link>
        <h1 className="page-title">Nueva solicitud de integración</h1>
        <p className="text-secondary mb-0">
          Formulario recomendado para registrar tu organización y definir el tenant en Nexum.
        </p>
      </div>
      <DevPortalFormWizard />
    </div>
  )
}

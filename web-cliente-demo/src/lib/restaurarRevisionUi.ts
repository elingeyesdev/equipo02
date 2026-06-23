import type { RespuestaMutacionDato } from '../services/apiDatos'
import type { AppRole } from '../types/demo'

export type AvisoRestaurar =
  | { tipo: 'pendiente' }
  | { tipo: 'confirmado'; txId?: string }

export function puedeProponerRestauracion(role: AppRole): boolean {
  return role === 'admin' || role === 'integrador'
}

export function etiquetaBotonRestaurar(role: AppRole): string {
  return role === 'integrador' ? 'Solicitar restauración' : 'Restaurar esta revisión'
}

export function mensajeConfirmRestaurar(role: AppRole): string {
  if (role === 'integrador') {
    return (
      'Se enviará una solicitud de restauración al administrador del tenant. ' +
      'La cadena no cambiará hasta que la apruebe en la cola de aprobación. ¿Continuar?'
    )
  }
  return (
    'Se creará un NUEVO bloque con los datos de esta revisión histórica. ' +
    'La cadena no se borra. ¿Deseas continuar?'
  )
}

export function resolverAvisoRestaurar(r: RespuestaMutacionDato): AvisoRestaurar {
  if (r.estado === 'pendiente') return { tipo: 'pendiente' }
  return { tipo: 'confirmado', txId: r.txId }
}

import { describe, expect, it } from 'vitest'
import {
  etiquetaBotonRestaurar,
  mensajeConfirmRestaurar,
  puedeProponerRestauracion,
  resolverAvisoRestaurar,
} from './restaurarRevisionUi'

describe('restaurarRevisionUi', () => {
  it('permite restauración a admin e integrador', () => {
    expect(puedeProponerRestauracion('admin')).toBe(true)
    expect(puedeProponerRestauracion('integrador')).toBe(true)
    expect(puedeProponerRestauracion('solo_lectura')).toBe(false)
  })

  it('usa etiquetas distintas por rol', () => {
    expect(etiquetaBotonRestaurar('admin')).toBe('Restaurar esta revisión')
    expect(etiquetaBotonRestaurar('integrador')).toBe('Solicitar restauración')
  })

  it('confirma cola de aprobación para integrador', () => {
    expect(mensajeConfirmRestaurar('integrador')).toMatch(/cola de aprobación/i)
    expect(mensajeConfirmRestaurar('admin')).toMatch(/NUEVO bloque/i)
  })

  it('resuelve aviso pendiente o confirmado', () => {
    expect(resolverAvisoRestaurar({ ok: true, estado: 'pendiente', solicitudId: 'SOL-1' })).toEqual({
      tipo: 'pendiente',
    })
    expect(resolverAvisoRestaurar({ ok: true, txId: 'tx-nuevo' })).toEqual({
      tipo: 'confirmado',
      txId: 'tx-nuevo',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { buildAccionesFromHistorial, metaRestauracionDesdeRecord } from './lineaTiempoAcciones'
import type { HistorialFilaVista } from '../services/apiHistorialCliente'

describe('lineaTiempoAcciones', () => {
  it('detecta restauración desde _baasMeta en payload string', () => {
    const record = {
      datoId: 'LOTE-EVA',
      tipo: 'LOTE',
      payload: JSON.stringify({
        nombre: 'Lote Eva',
        _baasMeta: { restauradoDesdeTxId: 'tx-original-123' },
      }),
    }
    expect(metaRestauracionDesdeRecord(record)).toBe('tx-original-123')
  })

  it('clasifica bloque restaurado con etiqueta Restauración', () => {
    const ops: HistorialFilaVista[] = [
      { txId: 'tx0', timestamp: '2026-06-11T10:00:00Z', isDelete: false, resumen: 'creado' },
      {
        txId: 'tx1',
        timestamp: '2026-06-11T11:00:00Z',
        isDelete: false,
        resumen: 'edit',
        restauradoDesdeTxId: 'tx0',
      },
    ]
    const acciones = buildAccionesFromHistorial(ops)
    expect(acciones[1]?.tipo).toBe('restaurado')
    expect(acciones[1]?.etiqueta).toBe('Restauración #1')
  })
})

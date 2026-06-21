import { apiJson } from './apiClient'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import type { ClienteApi } from '../types/api'

interface ListaBody {
  ok?: boolean
  datos?: unknown
}

/**
 * Obtiene filas del ledger para el tenant activo. Modelo UNIVERSAL: todos los
 * tenants usan el recurso genérico `/datos` (dato_cc). El parámetro `tenant`
 * se mantiene por compatibilidad de firma pero ya no altera el endpoint.
 */
export async function listarClientesApi(_tenant?: string): Promise<ClienteApi[]> {
  const j = await apiJson<ListaBody>('/datos')
  const d = j.datos
  if (d == null || !Array.isArray(d)) return []
  return d
    .map((row) => parseDatoDatos(row))
    .filter((x): x is ClienteApi => x !== null)
}

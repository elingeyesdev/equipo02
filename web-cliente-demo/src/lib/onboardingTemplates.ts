export type AttributeType = 'texto' | 'numero' | 'booleano' | 'fecha' | 'lista'

export type AttributeDraft = {
  id: string
  name: string
  type: AttributeType
  example: string
}

export type PayloadTemplate = {
  id: string
  label: string
  entityType: string
  schemaVersion: string
  entityName: string
  businessIdField: string
  attributes: Array<Omit<AttributeDraft, 'id'>>
}

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  texto: 'Texto',
  numero: 'Numero',
  booleano: 'Si / No',
  fecha: 'Fecha (ISO)',
  lista: 'Lista (JSON)',
}

export const PAYLOAD_TEMPLATES: PayloadTemplate[] = [
  {
    id: 'agro',
    label: 'Ejemplo: Agro (lotes)',
    entityType: 'lote',
    schemaVersion: 'v1',
    entityName: 'Lote',
    businessIdField: 'codigo_trazabilidad',
    attributes: [
      { name: 'codigo', type: 'texto', example: 'LOTE-001' },
      { name: 'nombre', type: 'texto', example: 'Lote Norte' },
      { name: 'estado', type: 'texto', example: 'en_produccion' },
      {
        name: 'actividades',
        type: 'lista',
        example: '[{"id":"ACT-1","nombre":"Riego","fecha":"2026-06-12"}]',
      },
      {
        name: 'producciones',
        type: 'lista',
        example: '[{"id":"PROD-1","tipo":"tomate","cantidad":120,"unidad":"kg"}]',
      },
      { name: 'sincronizadoEn', type: 'fecha', example: '2026-06-12T00:00:00Z' },
    ],
  },
  {
    id: 'salud',
    label: 'Ejemplo: Salud (consultas)',
    entityType: 'consulta',
    schemaVersion: 'v1',
    entityName: 'Consulta',
    businessIdField: 'numero_expediente',
    attributes: [
      { name: 'pacienteId', type: 'texto', example: 'PAC-001' },
      { name: 'nombrePaciente', type: 'texto', example: 'María López' },
      { name: 'diagnostico', type: 'texto', example: 'Control rutinario' },
      { name: 'medico', type: 'texto', example: 'Dr. Pérez' },
      { name: 'fechaConsulta', type: 'fecha', example: '2026-06-12T10:30:00Z' },
      { name: 'activo', type: 'booleano', example: 'true' },
    ],
  },
  {
    id: 'erp',
    label: 'Ejemplo: ERP generico',
    entityType: 'registro_erp',
    schemaVersion: 'v1',
    entityName: 'Factura',
    businessIdField: 'numero_factura',
    attributes: [
      { name: 'codigo', type: 'texto', example: 'ERP-0001' },
      { name: 'tipoOperacion', type: 'texto', example: 'venta' },
      { name: 'estado', type: 'texto', example: 'aprobado' },
      { name: 'monto', type: 'numero', example: '1500.75' },
      { name: 'moneda', type: 'texto', example: 'USD' },
      { name: 'updatedAt', type: 'fecha', example: '2026-06-12T00:00:00Z' },
    ],
  },
  {
    id: 'academico',
    label: 'Ejemplo: Academico',
    entityType: 'registro_academico',
    schemaVersion: 'v1',
    entityName: 'Matricula',
    businessIdField: 'codigo_matricula',
    attributes: [
      { name: 'codigo', type: 'texto', example: 'MAT-001' },
      { name: 'estudianteId', type: 'texto', example: 'EST-100' },
      { name: 'materia', type: 'texto', example: 'Blockchain I' },
      { name: 'estado', type: 'texto', example: 'aprobado' },
      { name: 'notaFinal', type: 'numero', example: '18' },
      { name: 'updatedAt', type: 'fecha', example: '2026-06-12T00:00:00Z' },
    ],
  },
]

export function attributeExampleValue(attr: Pick<AttributeDraft, 'type' | 'example'>): unknown {
  const raw = attr.example.trim()
  switch (attr.type) {
    case 'numero': {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : 0
    }
    case 'booleano':
      return raw.toLowerCase() === 'true' || raw.toLowerCase() === 'si'
    case 'lista': {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return raw ? [raw] : []
      }
    }
    case 'fecha':
    case 'texto':
    default:
      return raw
  }
}

export function buildPayloadFromAttributes(attributes: AttributeDraft[], schemaVersion: string): string {
  const payload: Record<string, unknown> = {
    schemaVersion: schemaVersion.trim() || 'v1',
  }
  for (const attr of attributes) {
    const name = attr.name.trim()
    if (!name) continue
    payload[name] = attributeExampleValue(attr)
  }
  return JSON.stringify(payload, null, 2)
}

export function withAttributeIds(attributes: Array<Omit<AttributeDraft, 'id'>>): AttributeDraft[] {
  return attributes.map((attr) => ({ ...attr, id: crypto.randomUUID() }))
}

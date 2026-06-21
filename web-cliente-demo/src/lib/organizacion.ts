/**
 * Etiqueta legible para el id técnico de organización (tenant en backend).
 * Agnóstica del dominio: capitaliza el id del tenant, sea cual sea.
 */
export function etiquetaOrganizacion(tenantId: string | undefined | null): string {
  const t = (tenantId ?? '').trim()
  if (!t) return '—'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** YYYY-MM-DD se interpreta al mediodía local para no adelantar/retroceder el día. */
function parseFechaLedger(iso: string): Date {
  const t = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T12:00:00`)
  return new Date(t)
}

export function formatDemoDateTime(iso: string): string {
  try {
    const d = parseFechaLedger(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Convención visual de fecha media (`dateStyle: 'medium'`, es-PE). */
export function formatShortDate(iso: string): string {
  try {
    const d = parseFechaLedger(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('es-PE', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

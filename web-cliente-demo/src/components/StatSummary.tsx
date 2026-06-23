interface StatSummaryProps {
  /** Cantidad devuelta por GET /datos (ledger). */
  totalClientesEnRed: number
  entityLabel?: string
  ledgerEndpointHint?: string
  tokenOpsCount?: number
  consultasCount?: number
  eventosCount?: number
  showTokenCard?: boolean
  /** Etiqueta breve del origen de datos (p. ej. API vía proxy). */
  dataSourceLabel?: string
}

export function StatSummary({
  totalClientesEnRed,
  entityLabel = 'Clientes registrados',
  ledgerEndpointHint = 'Datos del ledger vía GET /datos',
  tokenOpsCount = 0,
  consultasCount = 0,
  eventosCount = 0,
  showTokenCard = true,
  dataSourceLabel = 'Red / API',
}: StatSummaryProps) {
  const cardsBase: {
    label: string
    value: string
    hint: string
    trend: string | null
    trendUp: boolean
    highlight?: boolean
  }[] = [
    {
      label: entityLabel,
      value: totalClientesEnRed.toLocaleString('es-PE'),
      hint: ledgerEndpointHint,
      trend: dataSourceLabel,
      trendUp: true,
    },
    ...(showTokenCard
      ? [
          {
            label: 'Operaciones token',
            value: tokenOpsCount.toLocaleString('es-PE'),
            hint: 'Emisiones y transferencias registradas',
            trend: 'Historial',
            trendUp: true,
          },
        ]
      : []),
    {
      label: 'Consultas realizadas',
      value: consultasCount.toLocaleString('es-PE'),
      hint: 'Consultas ejecutadas desde la aplicación',
      trend: 'Contador',
      trendUp: true,
    },
    {
      label: 'Historial de actividad',
      value: eventosCount.toLocaleString('es-PE'),
      hint: 'Eventos y operaciones en esta sesión',
      trend: 'Últimos 200',
      trendUp: true,
    },
    {
      label: 'Estado del sistema',
      value: 'Operativo',
      hint: 'Datos obtenidos desde la red/API cuando el middleware responde',
      trend: null,
      trendUp: true,
      highlight: true,
    },
  ]

  return (
    <div className={`grid shrink-0 gap-3 sm:grid-cols-2 ${showTokenCard ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
      {cardsBase.map((c) => (
        <div key={c.label} className="admin-card p-4">
          <p className="text-xs font-medium text-muted">{c.label}</p>
          <p
            className={[
              'mt-2 text-2xl font-semibold tracking-tight',
              c.highlight ? 'text-success' : 'text-ink',
            ].join(' ')}
          >
            {c.value}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">{c.hint}</p>
            {c.trend ? (
              <span
                className={[
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  c.trendUp ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink',
                ].join(' ')}
              >
                {c.trend}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

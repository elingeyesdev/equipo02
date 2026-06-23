import { useEffect, useRef, useState } from 'react'

export const inputClass = 'form-control'

export const textareaClass = 'form-control'

export function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value)
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function randomKey(prefix: string): string {
  const raw = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${raw}`
}

export function Field({
  label,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string
  help?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="form-label">
      <span className="d-flex align-items-center gap-2">
        <span>{label}</span>
        {help ? <HelpTooltip text={help} /> : null}
      </span>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  )
}

export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <span ref={containerRef} className="position-relative d-inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="btn btn-sm btn-ghost-secondary rounded-circle p-0"
        style={{ width: '1.25rem', height: '1.25rem', fontSize: '0.65rem' }}
        aria-label="Mostrar ayuda del campo"
      >
        ?
      </button>
      {open ? (
        <span className="position-absolute start-0 top-100 mt-1 p-2 bg-white border rounded shadow-sm small" style={{ width: '16rem', zIndex: 20 }}>
          {text}
        </span>
      ) : null}
    </span>
  )
}

export function StepIntro({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="alert alert-info mt-3">
      <p className="fw-semibold mb-2">{title}</p>
      <ul className="mb-0 ps-3">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

export function ExampleNotice({ text }: { text: string }) {
  return (
    <div className="alert alert-warning mt-3">
      <p className="fw-semibold mb-1">Valores de ejemplo</p>
      <p className="mb-0 small">{text}</p>
    </div>
  )
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <div className="card bg-primary-lt mt-3">
      <div className="card-body">
        <p className="fw-semibold text-primary">Checklist sugerido</p>
        <ul className="mb-0 small">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function SnippetBlock({
  title,
  value,
  onCopy,
}: {
  title: string
  value: string
  onCopy: () => void
}) {
  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="card-title mb-0">{title}</h4>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCopy}>
          Copiar
        </button>
      </div>
      <div className="card-body p-0">
        <pre className="snippet-pre p-3 bg-light">{value}</pre>
      </div>
    </div>
  )
}

export function RoleAlert({ role }: { role: 'integrador' | 'admin' | 'lectura' }) {
  if (role === 'integrador') {
    return (
      <div className="alert alert-warning mt-3">
        <p className="fw-semibold mb-1">Rol integrador → HTTP 202 (pendiente)</p>
        <p className="mb-0 small">
          Tus POST/PUT/DELETE no escriben directo en cadena. Recibir 202 es el comportamiento esperado.
        </p>
      </div>
    )
  }
  if (role === 'admin') {
    return (
      <div className="alert alert-success mt-3">
        <p className="fw-semibold mb-1">Rol admin → HTTP 201 (escritura directa)</p>
        <p className="mb-0 small">Las mutaciones se confirman en blockchain de inmediato con txId.</p>
      </div>
    )
  }
  return (
    <div className="alert alert-danger mt-3">
      <p className="fw-semibold mb-1">Rol lectura → solo GET</p>
      <p className="mb-0 small">Esta key sirve para consultas e historial. Mutaciones devuelven 403.</p>
    </div>
  )
}

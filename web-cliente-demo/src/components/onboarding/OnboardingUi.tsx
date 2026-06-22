import { useEffect, useRef, useState } from 'react'

export const inputClass =
  'w-full rounded-lg border border-line/80 bg-white px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/70 transition-shadow focus:border-[#1a3a5c]/40 focus:ring-2 focus:ring-[#1a3a5c]/10'

export const textareaClass = `${inputClass} resize-y leading-relaxed`

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
    <label className="block text-xs font-medium text-[#6b7280]">
      <span className="mb-1.5 flex items-center gap-2 text-[#374151]">
        <span>{label}</span>
        {help ? <HelpTooltip text={help} /> : null}
      </span>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
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
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line bg-gray-50 text-[10px] font-bold text-ink-secondary hover:bg-gray-100"
        aria-label="Mostrar ayuda del campo"
      >
        ?
      </button>
      {open ? (
        <span className="absolute left-0 top-6 z-20 w-64 rounded-md border border-line bg-surface p-2 text-[11px] font-normal leading-4 text-ink-secondary shadow-card">
          {text}
        </span>
      ) : null}
    </span>
  )
}

export function StepIntro({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#1a3a5c]/10 bg-[#f4f7fb] px-5 py-4">
      <p className="text-sm font-semibold text-[#1a2332]">{title}</p>
      <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[#4b5563]">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0b429]" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExampleNotice({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4">
      <p className="text-sm font-semibold text-amber-900">Valores de ejemplo</p>
      <p className="mt-2 text-sm leading-relaxed text-amber-800/90">{text}</p>
    </div>
  )
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#1a3a5c]/12 bg-[#1a3a5c]/5 px-5 py-4">
      <p className="text-sm font-semibold text-[#1a3a5c]">Checklist sugerido</p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#4b5563]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[#1a3a5c]">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
    <div className="mt-6 overflow-hidden rounded-2xl border border-line/60 bg-[#fafbfd]">
      <div className="flex items-center justify-between gap-3 border-b border-line/60 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-[#1a2332]">{title}</p>
        <button
          type="button"
          className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f9fafb]"
          onClick={onCopy}
        >
          Copiar
        </button>
      </div>
      <pre className="max-h-80 overflow-auto px-4 py-4 text-xs leading-relaxed text-[#374151]">{value}</pre>
    </div>
  )
}

export function RoleAlert({ role }: { role: 'integrador' | 'admin' | 'lectura' }) {
  if (role === 'integrador') {
    return (
      <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-sm leading-relaxed text-amber-900">
        <p className="font-semibold">Rol integrador → HTTP 202 (pendiente)</p>
        <p className="mt-2">
          Tus POST/PUT/DELETE <strong>no escriben directo en cadena</strong>. El BaaS crea una solicitud
          pendiente y un admin debe aprobarla en la consola. Recibir 202 es el comportamiento esperado, no un
          error.
        </p>
      </div>
    )
  }
  if (role === 'admin') {
    return (
      <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-5 py-4 text-sm leading-relaxed text-emerald-900">
        <p className="font-semibold">Rol admin → HTTP 201 (escritura directa)</p>
        <p className="mt-2">
          Las mutaciones se confirman en blockchain de inmediato. La respuesta incluye <code>txId</code>.
        </p>
      </div>
    )
  }
  return (
    <div className="mt-5 rounded-2xl border border-red-200/80 bg-red-50/80 px-5 py-4 text-sm leading-relaxed text-red-900">
      <p className="font-semibold">Rol lectura → solo GET</p>
      <p className="mt-2">Esta key sirve para consultas e historial. Cualquier POST/PUT/DELETE devolverá 403.</p>
    </div>
  )
}

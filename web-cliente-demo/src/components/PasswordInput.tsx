import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  wrapperClassName?: string
  toggleClassName?: string
  startIcon?: ReactNode
}

export function PasswordInput({
  value,
  onChange,
  className = 'form-control',
  wrapperClassName = 'password-input-wrap',
  toggleClassName = 'password-input-toggle',
  startIcon,
  disabled,
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={wrapperClassName}>
      {startIcon}
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        className={toggleClassName}
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {visible ? <IconEyeOff size={18} stroke={1.75} /> : <IconEye size={18} stroke={1.75} />}
      </button>
    </div>
  )
}

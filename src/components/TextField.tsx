import { useId, type InputHTMLAttributes } from 'react'
import './ui.css'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
  /** 오류 문구. 있으면 Error 상태로 표시 */
  error?: string | null
  /** 문구는 바깥에 두고 Error 상태 색만 쓸 때 */
  invalid?: boolean
  /** 완료 문구. 있으면 Success 상태로 표시 */
  success?: string | null
  hint?: string
  size?: 'md' | 'lg'
  variant?: 'text' | 'code'
}

export function TextField({
  label,
  value,
  onChange,
  error,
  invalid,
  success,
  hint,
  size = 'md',
  variant = 'text',
  disabled,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? success ?? hint
  const isError = Boolean(error) || Boolean(invalid)
  const state = disabled ? 'disabled' : isError ? 'error' : success ? 'success' : null

  return (
    <div className={['field', size === 'lg' && 'field--lg', state && `field--${state}`, className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={id}
          className={variant === 'code' ? 'field__input field__input--code' : 'field__input'}
          value={value}
          disabled={disabled}
          aria-invalid={isError || undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(e) => onChange(variant === 'code' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value)}
          {...(variant === 'code' ? { inputMode: 'numeric' as const, autoComplete: 'one-time-code', maxLength: 6 } : {})}
          {...rest}
        />
      </div>
      {message && (
        <p id={messageId} className="field__hint" role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  )
}

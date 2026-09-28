import './ui.css'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  busy?: boolean
}

/** Figma 1255:2147 Toggle — 켜짐/꺼짐 스위치. label은 화면에 보이지 않고 스크린 리더로 읽힌다 */
export function Toggle({ checked, onChange, label, disabled, busy }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      className={checked ? 'toggle is-on' : 'toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" aria-hidden="true" />
    </button>
  )
}

import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import './ui.css'

type Tone = 'primary' | 'secondary' | 'ink' | 'outline' | 'outline-strong' | 'error'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone
  size?: 'md' | 'lg'
  block?: boolean
  /** 요청 중. 모양은 유지하고 중복 클릭만 막는다 */
  busy?: boolean
}

export function Button({ tone = 'primary', size = 'md', block, busy, className, type = 'button', onClick, ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${tone}`, size === 'lg' && 'btn--lg', block && 'btn--block', busy && 'btn--busy', className]

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (busy) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }

  return (
    <button
      type={type}
      className={classes.filter(Boolean).join(' ')}
      aria-busy={busy || undefined}
      onClick={handleClick}
      {...rest}
    />
  )
}

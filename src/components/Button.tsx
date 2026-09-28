import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import './ui.css'

type Tone = 'primary' | 'secondary' | 'soft' | 'ink' | 'outline' | 'outline-strong' | 'error'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone
  /** md 40px · lg 50px(로그인 폼) · xl 64px(화면의 마지막 주요 행동) */
  size?: 'md' | 'lg' | 'xl'
  block?: boolean
  /** 요청 중. 모양은 유지하고 중복 클릭만 막는다 */
  busy?: boolean
}

export function Button({ tone = 'primary', size = 'md', block, busy, className, type = 'button', onClick, ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${tone}`, size !== 'md' && `btn--${size}`, block && 'btn--block', busy && 'btn--busy', className]

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

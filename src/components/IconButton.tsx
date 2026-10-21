import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 아이콘만 보이므로 스크린 리더용 이름이 꼭 필요하다 */
  label: string
  /** outline: 흰 바탕 + 연회색 테두리 · filled: 블랙으로 채운 강조형 */
  tone?: 'outline' | 'filled'
  size?: 'md' | 'sm'
}

/** 원형 아이콘 버튼 (48px, sm 36px) */
export function IconButton({ label, tone = 'outline', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  const classes = ['icon-btn', tone === 'filled' && 'icon-btn--filled', size === 'sm' && 'icon-btn--sm', className]
  return <button type={type} aria-label={label} title={label} className={classes.filter(Boolean).join(' ')} {...rest} />
}

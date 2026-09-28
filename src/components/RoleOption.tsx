import type { KeyboardEvent } from 'react'
import type { UserRole } from '../api/types'
import { ROLE_OPTIONS } from '../lib/roles'
import './ui.css'

interface RoleGroupProps {
  value: UserRole
  onChange: (role: UserRole) => void
  labelledBy: string
}

/** 라디오 그룹 — 방향키로 선택을 옮길 수 있다 */
export function RoleGroup({ value, onChange, labelledBy }: RoleGroupProps) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = ROLE_OPTIONS.findIndex((o) => o.value === value)
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = ROLE_OPTIONS[(i + step + ROLE_OPTIONS.length) % ROLE_OPTIONS.length]
    onChange(next.value)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-role="${next.value}"]`)?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="role-group" onKeyDown={onKeyDown}>
      {ROLE_OPTIONS.map((o) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-role={o.value}
            className="option"
            onClick={() => onChange(o.value)}
          >
            <span className="option__title">{o.title}</span>
            <span className="option__body">{o.body}</span>
          </button>
        )
      })}
    </div>
  )
}

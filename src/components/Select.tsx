import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconChevronDown } from '@tabler/icons-react'
import './select.css'

interface Option {
  value: string
  label: ReactNode
  disabled: boolean
}

/** <option>을 그대로 자식으로 받는다 (Fragment와 배열 안의 것도 포함) */
function readOptions(children: ReactNode): Option[] {
  const out: Option[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>
    if (el.type === Fragment) out.push(...readOptions(el.props.children))
    else if (el.type === 'option') {
      const label = el.props.children
      out.push({ value: String(el.props.value ?? label ?? ''), label, disabled: Boolean(el.props.disabled) })
    }
  })
  return out
}

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value' | 'type'> {
  value: string | number
  onChange: (e: { target: { value: string }; currentTarget: { value: string } }) => void
  children: ReactNode
}

/**
 * 서비스 디자인 시스템에 맞춘 선택 상자. 브라우저 기본 드롭다운(macOS의 리퀴드 글래스) 대신 쓴다.
 * <select>와 같은 모양으로 쓴다: value, onChange(e.target.value), <option> 자식, disabled.
 */
export function Select({ value, onChange, children, className, disabled, onKeyDown, ...rest }: SelectProps) {
  const options = useMemo(() => readOptions(children), [children])
  const current = String(value)
  const selectedIndex = options.findIndex((o) => o.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()

  const enabled = (i: number, dir: 1 | -1) => {
    for (let n = 1; n <= options.length; n++) {
      const j = (i + dir * n + options.length * n) % options.length
      if (!options[j].disabled) return j
    }
    return i
  }

  function show() {
    if (disabled) return
    setActive(selectedIndex >= 0 ? selectedIndex : enabled(-1, 1))
    setOpen(true)
  }
  function hide(focus = true) {
    setOpen(false)
    if (focus) trigger.current?.focus()
  }
  function pick(i: number) {
    const o = options[i]
    if (!o || o.disabled) return
    hide()
    if (o.value !== current) onChange({ target: { value: o.value }, currentTarget: { value: o.value } })
  }

  // 열릴 때 트리거 아래(자리가 모자라면 위)에 맞춰 놓는다. 스크롤 영역에 잘리지 않도록 body에 그린다
  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    const need = Math.min(options.length * 40 + 12, 320)
    const up = window.innerHeight - r.bottom < need + 16 && r.top > window.innerHeight - r.bottom
    setBox({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, up })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const close = () => hide(false)
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) close()
    }
    document.addEventListener('mousedown', away)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(e)
    if (e.defaultPrevented || disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      hide()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => enabled(a, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => enabled(a, -1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(enabled(-1, 1))
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(enabled(0, -1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(active)
    } else if (e.key === 'Tab') {
      hide(false)
    }
  }

  const label = selectedIndex >= 0 ? options[selectedIndex].label : null

  return (
    <>
      <button
        {...rest}
        ref={trigger}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={['select__trigger', open && 'is-open', className].filter(Boolean).join(' ')}
        disabled={disabled}
        onClick={() => (open ? hide(false) : show())}
        onKeyDown={onKey}
      >
        <span className="select__value">{label}</span>
        <IconChevronDown className="select__chevron" size={16} aria-hidden="true" />
      </button>
      {open &&
        box &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            className={box.up ? 'select__menu select__menu--up' : 'select__menu'}
            style={{ left: box.left, top: box.top, minWidth: box.width }}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={i === selectedIndex}
                aria-disabled={o.disabled || undefined}
                data-active={i === active}
                className="select__option"
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
              >
                <span className="select__option-label">{o.label}</span>
                {i === selectedIndex && <IconCheck size={16} stroke={2} aria-hidden="true" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}

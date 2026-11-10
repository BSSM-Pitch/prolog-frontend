import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  IconBell,
  IconBook2,
  IconChevronDown,
  IconHome,
  IconNotebook,
  IconRoute,
  IconUser,
  IconUsersGroup,
  IconWorld,
  type IconProps,
} from '@tabler/icons-react'
import { Logo } from '../components/Logo'

/** 화면을 그리는 기준 크기(주소 표시줄 제외). 실제 앱을 이 크기의 데스크톱 화면으로 그린 뒤 칸 너비에 맞춰 줄인다 */
export const SCREEN_W = 1320
export const SCREEN_H = 860
const BAR_H = 40

export type MenuKey = 'home' | 'manuscripts' | 'overview' | 'characters' | 'world' | 'members'

const MENU: Array<{ key: MenuKey; label: string; icon: ComponentType<IconProps> }> = [
  { key: 'home', label: '작품 홈', icon: IconHome },
  { key: 'manuscripts', label: '원고', icon: IconNotebook },
  { key: 'overview', label: '작품 살펴보기', icon: IconRoute },
  { key: 'characters', label: '등장인물', icon: IconUser },
  { key: 'world', label: '세계관', icon: IconWorld },
  { key: 'members', label: '팀원 초대', icon: IconUsersGroup },
]

const BLANK = '<!doctype html><html lang="ko" class="lp-demo-doc"><head></head><body></body></html>'

/**
 * 브라우저 창 모양의 틀. 안쪽은 SCREEN_W 너비의 iframe이라, 앱 CSS의 화면 너비 규칙(@media)이
 * 랜딩 칸 너비가 아니라 데스크톱 너비로 계산된다. 앱 스타일시트를 그대로 복사해 넣으므로 앱이 바뀌면 함께 바뀐다.
 * 보여 주기용이라 누르거나 포커스할 수 없다.
 */
export function DemoFrame({ path, children }: { path: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const iframe = useRef<HTMLIFrameElement>(null)
  const styles = useRef<MutationObserver | null>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const fit = () => el.style.setProperty('--s', String(el.clientWidth / SCREEN_W))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => styles.current?.disconnect(), [])

  // iframe 문서에 앱 스타일시트를 복사하고, 개발 중 스타일이 바뀌면 다시 복사한다
  function onLoad() {
    const doc = iframe.current?.contentDocument
    if (!doc) return
    const sync = () =>
      doc.head.replaceChildren(
        ...[...document.head.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.cloneNode(true)),
      )
    sync()
    styles.current?.disconnect()
    styles.current = new MutationObserver(sync)
    styles.current.observe(document.head, { childList: true, subtree: true, characterData: true })
    setBody(doc.body)
  }

  return (
    <div ref={frame} className="lp-window" style={{ aspectRatio: `${SCREEN_W} / ${SCREEN_H + BAR_H}` }}>
      <div className="lp-window__screen" style={{ width: SCREEN_W, height: SCREEN_H + BAR_H }}>
        <div className="lp-window__bar" style={{ height: BAR_H }}>
          <span className="lp-window__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="lp-window__url">prolog.app/{path}</span>
        </div>
        <iframe
          ref={iframe}
          className="lp-window__frame"
          title="Prolog 앱 화면 미리보기"
          srcDoc={BLANK}
          onLoad={onLoad}
          tabIndex={-1}
          aria-hidden="true"
          style={{ width: SCREEN_W, height: SCREEN_H }}
        />
        {body && createPortal(children, body)}
      </div>
    </div>
  )
}

/** 앱 화면: 실제 사이드바와 본문. 앱의 클래스(.app, .sidebar…)를 그대로 쓴다 */
export function AppScreen({ menu, children }: { menu: MenuKey; children: ReactNode }) {
  return (
    <div className="app lp-demo" inert>
      <aside className="sidebar">
        <span className="sidebar__brand">
          <Logo size={25} />
          <span>prolog</span>
        </span>
        <nav className="sidebar__nav">
          <span className="sidebar__item">
            <IconBook2 size={19} stroke={1.7} aria-hidden="true" />
            <span className="sidebar__label">내 서재</span>
          </span>
          <p className="sidebar__project">붉은 문 너머</p>
          {MENU.map(({ key, label, icon: I }) => (
            <span key={key} className={`sidebar__item${key === menu ? ' active' : ''}`}>
              <I size={19} stroke={1.7} aria-hidden="true" />
              <span className="sidebar__label">{label}</span>
            </span>
          ))}
        </nav>
        <nav className="sidebar__secondary">
          <span className="sidebar__item">
            <IconBell size={19} stroke={1.7} aria-hidden="true" />
            <span className="sidebar__label">알림</span>
          </span>
          <span className="sidebar__item">
            <IconUsersGroup size={19} stroke={1.7} aria-hidden="true" />
            <span className="sidebar__label">팀</span>
            <IconChevronDown className="sidebar__chevron" size={14} aria-hidden="true" />
          </span>
        </nav>
      </aside>
      <main className="app__main">{children}</main>
    </div>
  )
}

/** 앱의 Select 닫힌 모양 */
export function SelectBox({ value, className }: { value: string; className?: string }) {
  return (
    <button type="button" className={`select__trigger${className ? ` ${className}` : ''}`}>
      <span className="select__value">{value}</span>
      <IconChevronDown className="select__chevron" size={16} aria-hidden="true" />
    </button>
  )
}

/** 글을 쓰는 중임을 보여 주는 깜빡이는 커서 */
export function Caret() {
  return <span className="lp-caret" aria-hidden="true" />
}

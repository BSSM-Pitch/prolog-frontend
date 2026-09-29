import type { OAuthProvider } from '../api/types'
import './ui.css'

interface SocialButtonsProps {
  mode: 'login' | 'signup'
  onSelect: (provider: OAuthProvider) => void
  disabled?: boolean
}

const PROVIDERS: Array<{ id: OAuthProvider; mark: string; name: string }> = [
  { id: 'google', mark: 'G', name: 'Google' },
  { id: 'naver', mark: 'N', name: '네이버' },
]

export function SocialButtons({ mode, onSelect, disabled }: SocialButtonsProps) {
  const suffix = mode === 'login' ? '로그인' : '회원가입'
  return (
    <div className="social">
      {PROVIDERS.map((p) => (
        <button key={p.id} type="button" className="social__btn" disabled={disabled} onClick={() => onSelect(p.id)}>
          <span className={`social__mark social__mark--${p.id}`} aria-hidden="true">
            {p.mark}
          </span>
          {p.name}로 {suffix}
        </button>
      ))}
    </div>
  )
}

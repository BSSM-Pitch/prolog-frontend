import type { OAuthProvider } from '../api/types'
import googleLogo from '../assets/social/google.png'
import kakaoLogo from '../assets/social/kakao.png'
import './ui.css'

interface SocialButtonsProps {
  mode: 'login' | 'signup'
  onSelect: (provider: OAuthProvider) => void
  disabled?: boolean
}

const PROVIDERS: Array<{ id: OAuthProvider; logo: string; name: string }> = [
  { id: 'google', logo: googleLogo, name: 'Google' },
  { id: 'kakao', logo: kakaoLogo, name: '카카오' },
]

export function SocialButtons({ mode, onSelect, disabled }: SocialButtonsProps) {
  const suffix = mode === 'login' ? '로그인' : '회원가입'
  return (
    <div className="social">
      {PROVIDERS.map((p) => (
        <button key={p.id} type="button" className="social__btn" disabled={disabled} onClick={() => onSelect(p.id)}>
          <img className={`social__mark social__mark--${p.id}`} src={p.logo} alt="" aria-hidden="true" />
          {p.name}로 {suffix}
          <span className="social__edge social__edge--left" aria-hidden="true" />
          <span className="social__edge social__edge--bottom" aria-hidden="true" />
          <span className="social__edge social__edge--right" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

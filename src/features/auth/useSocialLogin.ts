import { useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { IS_REAL } from '../../api/config'
import type { OAuthProvider } from '../../api/types'
import { useSession } from '../../auth/session'
import { takeReturnTo } from '../../lib/returnTo'
import { useSignupDraft } from '../../auth/signupDraft'
import { mockOAuthCode } from '../../lib/errors'

const NAMES: Record<OAuthProvider, string> = { google: 'Google', naver: '네이버' }

/**
 * 소셜 로그인·가입 (AUTH v0.2, 2단계).
 * real 모드의 Google은 인가 화면으로 이동했다가 /auth/callback으로 돌아와 finish를 부른다.
 * 목업은 인가 코드를 흉내 내 바로 finish한다.
 */
export function useSocialLogin() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { update } = useSignupDraft()

  async function finish(provider: OAuthProvider, code: string) {
    const res = await authApi.oauthLogin(provider, code)
    if (res.kind === 'session') {
      signIn(res.result)
      navigate(takeReturnTo(), { replace: true })
      return
    }
    update({ provider, signupTicket: res.signup_ticket, email: res.email ?? '', username: '', password: '' })
    navigate('/auth/signup', { replace: true, state: { notice: `${NAMES[provider]} 계정을 확인했어요. 사용할 아이디를 정하면 가입이 끝나요.` } })
  }

  /** 오류 문구를 돌려준다. 페이지를 떠나면 null */
  async function start(provider: OAuthProvider): Promise<void> {
    if (IS_REAL && provider === 'google') {
      const url = authApi.googleAuthorizeUrl()
      if (!url) throw new Error('Google 로그인 설정이 없어요. .env의 VITE_GOOGLE_CLIENT_ID를 백엔드와 같은 값으로 채워 주세요.')
      window.location.assign(url)
      return
    }
    await finish(provider, mockOAuthCode(provider))
  }

  return { start, finish }
}

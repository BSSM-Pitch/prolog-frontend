import { useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import { IS_REAL } from '../../api/config'
import type { OAuthProvider } from '../../api/types'
import { useSession } from '../../auth/session'
import { takeReturnTo } from '../../lib/returnTo'
import { useSignupDraft } from '../../auth/signupDraft'
import { mockOAuthCode } from '../../lib/errors'

export const PROVIDER_NAMES: Record<OAuthProvider, string> = { google: 'Google', naver: '네이버' }

/** real 모드 인가 화면 주소와, 설정이 없을 때 안내 */
const AUTHORIZE: Record<OAuthProvider, { url: () => string | null; missing: string }> = {
  google: {
    url: authApi.googleAuthorizeUrl,
    missing: 'Google 로그인 설정이 없어요. .env의 VITE_GOOGLE_CLIENT_ID를 백엔드와 같은 값으로 채워 주세요.',
  },
  naver: {
    url: authApi.naverAuthorizeUrl,
    missing: '네이버 로그인 설정이 없어요. .env의 VITE_NAVER_CLIENT_ID를 백엔드 NAVER_CLIENT_ID와 같은 값으로 채워 주세요.',
  },
}

/**
 * 소셜 로그인·가입 (AUTH v0.2, 2단계).
 * real 모드는 공급자 인가 화면으로 이동했다가 콜백(/auth/callback, /auth/callback/naver)으로 돌아와 finish를 부른다.
 * 목업은 인가 코드를 흉내 내 바로 finish한다.
 */
export function useSocialLogin() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { update } = useSignupDraft()

  async function finish(provider: OAuthProvider, code: string, state?: string | null) {
    const res = await authApi.oauthLogin(provider, code, state)
    if (res.kind === 'session') {
      signIn(res.result)
      navigate(takeReturnTo(), { replace: true })
      return
    }
    update({ provider, signupTicket: res.signup_ticket, email: res.email ?? '', username: '', password: '' })
    navigate('/auth/signup', { replace: true, state: { notice: `${PROVIDER_NAMES[provider]} 계정을 확인했어요. 사용할 아이디를 정하면 가입이 끝나요.` } })
  }

  /** real 모드는 인가 화면으로 떠난다. 실패하면 ApiError를 던진다 */
  async function start(provider: OAuthProvider): Promise<void> {
    if (IS_REAL) {
      const url = AUTHORIZE[provider].url()
      if (!url) throw new ApiError(0, { code: 'OAUTH_NOT_CONFIGURED', message: AUTHORIZE[provider].missing, details: {} })
      window.location.assign(url)
      return
    }
    await finish(provider, mockOAuthCode(provider))
  }

  return { start, finish }
}

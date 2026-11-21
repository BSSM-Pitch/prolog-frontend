import { useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import { IS_REAL } from '../../api/config'
import type { AuthTokens, OAuthProvider } from '../../api/types'
import type { OAuthResult } from '../../api/auth'
import { useSession } from '../../auth/session'
import { takeReturnTo } from '../../lib/returnTo'
import { useSignupDraft } from '../../auth/signupDraft'
import { mockOAuthCode } from '../../lib/errors'

export const PROVIDER_NAMES: Record<OAuthProvider, string> = { google: 'Google', kakao: '카카오' }

/**
 * 소셜 로그인·가입 (AUTH v0.2, 2단계).
 * real 모드: Google은 프론트가 인가 화면으로 이동했다가 /auth/callback에서 code를 백엔드와 교환한다(프런트 주도).
 * 카카오는 백엔드 /auth/kakao/login으로 이동하면 백엔드가 인가·교환을 끝내고 /auth/callback/kakao로 결과를 돌려준다(백엔드 주도).
 * 목업은 두 공급자 모두 인가 코드를 흉내 내 바로 처리한다.
 */
export function useSocialLogin() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { update } = useSignupDraft()

  async function complete(provider: OAuthProvider, res: OAuthResult) {
    if (res.kind === 'session') {
      signIn(res.result)
      navigate(takeReturnTo(), { replace: true })
      return
    }
    update({ provider, signupTicket: res.signup_ticket, email: res.email ?? '', username: '', password: '' })
    navigate('/auth/signup', { replace: true, state: { notice: `${PROVIDER_NAMES[provider]} 계정을 확인했어요. 사용할 닉네임을 정하면 가입이 끝나요.` } })
  }

  async function finish(provider: OAuthProvider, code: string) {
    await complete(provider, await authApi.oauthLogin(provider, code))
  }

  /** 카카오 콜백이 URL 프래그먼트로 바로 준 토큰 — 사용자 정보만 추가로 받아 세션을 연다 */
  async function finishKakaoTokens(tokens: AuthTokens) {
    const user = await authApi.getMe(tokens.access_token)
    await complete('kakao', { kind: 'session', result: { user, tokens } })
  }

  /** real 모드는 인가 화면(구글)이나 백엔드 로그인 주소(카카오)로 떠난다. 실패하면 ApiError를 던진다 */
  async function start(provider: OAuthProvider): Promise<void> {
    if (!IS_REAL) {
      await finish(provider, mockOAuthCode(provider))
      return
    }
    if (provider === 'kakao') {
      window.location.assign(authApi.kakaoLoginUrl())
      return
    }
    const url = authApi.googleAuthorizeUrl()
    if (!url) throw new ApiError(0, { code: 'OAUTH_NOT_CONFIGURED', message: 'Google 로그인 설정이 없어요. .env의 VITE_GOOGLE_CLIENT_ID를 백엔드와 같은 값으로 채워 주세요.', details: {} })
    window.location.assign(url)
  }

  return { start, finish, finishKakaoTokens, complete }
}

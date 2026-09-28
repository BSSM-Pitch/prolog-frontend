/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * mock(기본): 브라우저 안의 목업 서버만 쓴다.
   * real: 백엔드에 있는 API는 실제 서버로, 아직 없는 API(AI 분석 등)는 목업으로 보낸다(혼합 모드).
   */
  readonly VITE_API_MODE?: 'mock' | 'real'
  /** 실제 서버 주소. 개발 중에는 Vite 프록시(/v1 → VITE_BACKEND_URL)를 쓰므로 기본값 /v1 */
  readonly VITE_API_BASE_URL?: string
  /** Google OAuth 클라이언트 ID (백엔드 GOOGLE_CLIENT_ID와 같은 값) */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Google 인가 후 돌아올 주소. 백엔드 GOOGLE_REDIRECT_URI와 같아야 한다. 기본값: 현재 주소/auth/callback */
  readonly VITE_GOOGLE_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

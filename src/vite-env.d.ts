/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "real"이면 VITE_API_BASE_URL의 실제 서버를 쓴다. 그 외에는 브라우저 목업 서버 */
  readonly VITE_API_MODE?: 'mock' | 'real'
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

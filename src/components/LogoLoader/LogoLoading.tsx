import { LogoLoader } from './LogoLoader'
import './logoLoading.css'

/** AI 응답 대기 블록 — 로고 모션과 짧은 안내 두 줄을 가운데에 놓는다 */
export function LogoLoading({ className }: { className?: string }) {
  return (
    <div className={['logo-loading', className].filter(Boolean).join(' ')} role="status">
      <LogoLoader height={72} style={{ transform: 'translateX(8px)' }} />
      <p className="logo-loading__text">
        AI 답변 생성 중입니다
        <br />
        다른 페이지로 이동해도 유지됩니다
      </p>
    </div>
  )
}

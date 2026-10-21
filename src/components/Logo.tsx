import './logo.css'

/** 원형 블랙 마크 + 워드마크. 마크만 쓸 때는 wordmark={false} */
export function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo__mark">
        <circle cx="16" cy="16" r="16" fill="var(--color-dark)" />
        <path
          d="M12.5 22.5V9.5h4.75a4.25 4.25 0 0 1 0 8.5H12.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {wordmark && <span className="logo__word">Prolog</span>}
    </span>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownBody } from './richTextModel'
import './richText.css'

/** Shared AI prose renderer. Source quotations and editable manuscripts stay verbatim. */
export function RichText({
  children,
  className = '',
}: {
  children: string | null | undefined
  className?: string
}) {
  return (
    <div className={`rich-text ${className}`}>
      <Markdown
        skipHtml
        disallowedElements={['img']}
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        components={{
          table: MarkdownTable,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdownBody(children ?? '')}
      </Markdown>
    </div>
  )
}

function MarkdownTable({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const measure = () => setOverflow(container.scrollWidth > container.clientWidth + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    if (container.firstElementChild) observer.observe(container.firstElementChild)
    measure()
    return () => observer.disconnect()
  }, [])
  return (
    <div className="rich-text__table-wrap">
      <div
        ref={ref}
        className="rich-text__table"
        role="region"
        aria-label={overflow ? '비교표, 좌우로 스크롤할 수 있어요' : '비교표'}
        tabIndex={overflow ? 0 : undefined}
      >
        <table>{children}</table>
      </div>
      {overflow && <p className="rich-text__scroll-hint">좌우로 스크롤하면 표 전체를 볼 수 있어요.</p>}
    </div>
  )
}

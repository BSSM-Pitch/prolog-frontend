import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { DEFAULT_PAPER_RATIO, ratioBounds, paperRatio, ratioAtPointer } from './editorLayoutModel'

const STORAGE_KEY = 'prolog:editor-paper-ratio'
export function useEditorSplit() {
  const [layout, setLayout] = useState<HTMLDivElement | null>(null)
  const dragging = useRef<number | null>(null)
  const [width, setWidth] = useState<number>()
  const [preferred, setRatio] = useState(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? paperRatio(Number(saved)) : DEFAULT_PAPER_RATIO }
    catch { return DEFAULT_PAPER_RATIO }
  })
  const ratio = paperRatio(preferred, width)
  const bounds = ratioBounds(width)
  useEffect(() => {
    if (!layout) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(layout)
    return () => observer.disconnect()
  }, [layout])
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, String(preferred)) } catch { /* Optional preference. */ } }, [preferred])
  function resize(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== event.pointerId || !layout) return
    const bounds = layout.getBoundingClientRect()
    setRatio(ratioAtPointer(event.clientX, bounds.left, bounds.width))
  }
  return {
    layout: setLayout,
    style: { '--paper-ratio': ratio } as CSSProperties,
    separator: <div
      className="editor__resize"
      role="separator"
      aria-label="원고와 AI 질문창 너비 조절"
      aria-orientation="vertical"
      aria-valuemin={Math.round(bounds.min)}
      aria-valuemax={Math.round(bounds.max)}
      aria-valuenow={Math.round(ratio)}
      aria-valuetext={`원고 ${Math.round(ratio)}%, 질문창 ${100 - Math.round(ratio)}%`}
      tabIndex={0}
      title="드래그하거나 방향키로 너비 조절 · 두 번 클릭하면 기본 너비"
      onPointerDown={(event) => { if (event.button !== 0) return; dragging.current = event.pointerId; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
      onPointerMove={resize}
      onPointerUp={(event) => { if (dragging.current !== event.pointerId) return; resize(event); dragging.current = null; event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={() => { dragging.current = null }}
      onLostPointerCapture={() => { dragging.current = null }}
      onDoubleClick={() => setRatio(DEFAULT_PAPER_RATIO)}
      onKeyDown={(event) => {
        const values: Record<string, number> = { ArrowLeft: ratio - 2, ArrowRight: ratio + 2, Home: bounds.min, End: bounds.max, Enter: DEFAULT_PAPER_RATIO }
        if (event.key in values) { event.preventDefault(); setRatio(paperRatio(values[event.key], width)) }
      }}
    ><span aria-hidden="true">⋮</span></div>,
  }
}

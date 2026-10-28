import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** 네이티브 dialog로 초점 가두기·Escape·닫은 뒤 초점 복귀를 제공한다. */
export function InsightDialog({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    return () => {
      dialog.close()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="insight-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <h2 className="panel__title">{title}</h2>
      {children}
    </dialog>
  )
}

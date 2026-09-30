import type { ComponentProps, MouseEvent } from 'react'
import './ui.css'

/**
 * 여러 줄 입력칸. 테두리·여백·배경은 바깥 틀(className, style)이 갖고 textarea는 그 안에서만 스크롤한다.
 * textarea에 직접 padding을 주면 스크롤할 때 글자가 여백까지 올라와 테두리에 닿는다.
 */
export function TextArea({ className, style, ...rest }: ComponentProps<'textarea'>) {
  // 틀의 여백을 눌러도 입력칸에 들어가게 한다
  const focusInput = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.querySelector('textarea')?.focus()
  }
  return (
    <div className={className ? `textbox ${className}` : 'textbox'} style={style} onClick={focusInput}>
      <textarea className="textbox__input" {...rest} />
    </div>
  )
}

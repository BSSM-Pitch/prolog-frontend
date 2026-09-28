import { Link } from 'react-router-dom'
import './ComingSoon.css'

/** 아직 구현하지 않은 화면 자리. Figma 화면 번호를 함께 보여 준다. */
export function ComingSoon({ title, figma }: { title: string; figma: string }) {
  return (
    <div className="coming-soon">
      <p className="coming-soon__crumb">준비 중</p>
      <h1 className="coming-soon__title">{title}</h1>
      <p className="coming-soon__body">이 화면({figma})은 다음 단계에서 만들어요.</p>
      <Link className="btn btn--outline" to="/projects">
        내 프로젝트로 돌아가기
      </Link>
    </div>
  )
}

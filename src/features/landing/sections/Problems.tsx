import type { ComponentType } from 'react'
import { VOICE } from '../../../content/voice'
import { FactsScene, FilesScene, PeopleScene, ScatteredScene } from '../illustrations/ProblemScenes'

/** 2. 쓰기 전의 문제점: 장이 늘어날수록 생기는 네 가지 어긋남 */
const SCENES: Record<(typeof VOICE.problems.items)[number]['key'], ComponentType> = {
  scattered: ScatteredScene,
  facts: FactsScene,
  people: PeopleScene,
  files: FilesScene,
}

export function Problems() {
  const { title, lead, items } = VOICE.problems
  return (
    <section className="lp-section problems" id="problem" aria-labelledby="problems-title">
      <header className="lp-section__head">
        <h2 id="problems-title">{title}</h2>
        <p>{lead}</p>
      </header>
      <ol className="problems__grid">
        {items.map(({ key, title: itemTitle, body }) => {
          const Scene = SCENES[key]
          return (
            <li key={key} className="problem">
              <Scene />
              <h3>{itemTitle}</h3>
              <p>{body}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

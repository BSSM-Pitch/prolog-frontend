import { DEMO_CHARACTERS, DEMO_RELATIONSHIPS } from '../../../api/mock/demo'
import type { Relationship } from '../../../api/types'
import { relationshipView } from '../../insights/insightModel'
import { RelationshipGraph } from '../../relationships/RelationshipGraph'
import { AppScreen, SelectBox } from './AppWindow'

// 작품 살펴보기 · 인물 관계(RelationshipsPage) — 장을 넘길수록 윤서를 둘러싼 관계가 늘고 바뀐다.
// 그래프와 계산은 앱의 RelationshipGraph · relationshipView를 그대로 쓴다.
const PEOPLE = DEMO_CHARACTERS.map(({ character_id, name }) => ({ character_id, name }))
const RELATIONSHIPS: Relationship[] = DEMO_RELATIONSHIPS.map((r) => ({
  relationship_id: r.relationship_id,
  source_character_id: r.source,
  target_character_id: r.target,
  history: r.history.map((h) => ({
    chapter: h.chapter,
    state: h.state,
    trust: h.trust,
    event_title: h.event,
    event_deleted: h.event_deleted ?? false,
  })),
}))
const LAST = 27
const FIRST = 4
const TABS = ['이야기 흐름', '인물 관계', '복선', '설정 검토']

const SLIDE_AT = 0.8
const SLIDE_END = 6
const FOCUS = SLIDE_END + 1.2
export const OVERVIEW_LENGTH = FOCUS + 3.6

const noop = () => {}

export function OverviewDemo({ t }: { t: number }) {
  const p = Math.min(1, Math.max(0, (t - SLIDE_AT) / (SLIDE_END - SLIDE_AT)))
  const chapter = Math.round(FIRST + (LAST - FIRST) * p)
  const focus = t >= FOCUS ? 'char_002' : 'char_001'
  const view = relationshipView(PEOPLE, RELATIONSHIPS, chapter, focus, 1)

  return (
    <AppScreen menu="overview">
      <div className="relations insight-page">
        <header className="insight-header">
          <h1 className="page-title">인물 관계</h1>
          <div className="insight-actions">
            <span className="insight-field">
              <span>원고</span>
              <SelectBox value="3차 원고" />
            </span>
            <button type="button" className="btn btn--outline">
              관계 추가
            </button>
          </div>
        </header>
        <nav className="insight-nav">
          {TABS.map((tab) => (
            <a key={tab} className={tab === '인물 관계' ? 'active' : ''} aria-current={tab === '인물 관계' ? 'page' : undefined}>
              {tab}
            </a>
          ))}
        </nav>
        <div className="relations__controls">
          <span className="insight-field">
            <span>중심 인물</span>
            <SelectBox value={focus === 'char_001' ? '윤서' : '재현'} />
          </span>
          <label className="relations__chapter">
            <span>
              <strong>{chapter}장</strong> 시점
            </span>
            <input type="range" min={1} max={LAST} value={chapter} readOnly />
          </label>
        </div>
        <RelationshipGraph view={view} selectedId={null} onPerson={noop} onRelationship={noop} />
        <p className="insight-caption">인물을 누르면 중심이 바뀌고, 관계를 누르면 기록이 열려요.</p>
      </div>
    </AppScreen>
  )
}

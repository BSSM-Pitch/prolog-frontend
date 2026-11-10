import { AppScreen, Caret, SelectBox } from './AppWindow'
import { typed, typingTime } from './clock'

// 팀원 초대(MembersPage) — 이메일과 역할을 고르면 보낸 초대 목록에 대기 중으로 올라간다.
const EMAIL = 'hana.editor@example.com'
const MEMBERS = [
  {
    name: '김유진 (나)',
    email: 'writer.kim@example.com',
    role: null,
    joined: '8월 12일',
  },
  {
    name: '이형민',
    email: 'hm.lee@gmail.com',
    role: '편집자',
    joined: '8월 14일',
  },
  {
    name: '박서연',
    email: 'seoyeon@gmail.com',
    role: '편집자',
    joined: '8월 20일',
  },
  {
    name: '정다은',
    email: 'daeun@gmail.com',
    role: '보기 전용',
    joined: '9월 2일',
  },
]

const TYPE_AT = 0.6
const ROLE = TYPE_AT + typingTime(EMAIL, 16) + 0.5
const SEND = ROLE + 0.9
const SENT = SEND + 0.8
export const TEAM_LENGTH = SENT + 3.8

export function TeamDemo({ t }: { t: number }) {
  const sent = t >= SENT
  const email = sent ? '' : typed(EMAIL, t, TYPE_AT, 16)
  const viewer = t >= ROLE

  return (
    <AppScreen menu="members">
      <div className="members">
        <header className="world__header">
          <div>
            <p className="page-crumb">붉은 문 너머 / 설정</p>
            <h1 className="page-title">팀원 초대</h1>
            <p className="page-desc">함께 작업할 사람을 초대하고 역할을 정하세요.</p>
          </div>
        </header>
        <div className="members__layout">
          {/* 창 높이에 맞추려고 보낸 초대 목록을 멤버 표 아래로 옮겼다(앱에서는 초대하기 아래) */}
          <div className="lp-members-main">
            <section className="panel">
              <h2 className="panel__title">멤버 4명</h2>
              <table className="members__table">
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">역할</th>
                    <th scope="col">참여일</th>
                    <th scope="col">
                      <span className="visually-hidden">작업</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MEMBERS.map((m) => (
                    <tr key={m.email}>
                      <td>
                        <span className="members__name">{m.name}</span>
                        <span className="members__email">{m.email}</span>
                      </td>
                      <td>
                        {m.role ? (
                          <SelectBox value={m.role} className="nl-select members__role" />
                        ) : (
                          <span className="badge badge--done">소유자</span>
                        )}
                      </td>
                      <td>{m.joined}</td>
                      <td className="members__action">
                        <button type="button" className="btn btn--outline">
                          {m.role ? '내보내기' : '나가기'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="panel">
              <h2 className="panel__title">보낸 초대</h2>
              <ul className="members__invites">
                {sent && (
                  <li className="members__invite lp-pop">
                    <span className="members__invite-email">
                      {EMAIL}
                      <span className="members__email">보기 전용</span>
                    </span>
                    <span className="badge badge--waiting">대기 중</span>
                    <button type="button" className="btn btn--outline">
                      취소
                    </button>
                  </li>
                )}
                <li className="members__invite">
                  <span className="members__invite-email">
                    writer2@example.com
                    <span className="members__email">편집자</span>
                  </span>
                  <span className="badge badge--waiting">대기 중</span>
                  <button type="button" className="btn btn--outline">
                    취소
                  </button>
                </li>
              </ul>
            </section>
          </div>
          <div className="members__side">
            <section className="panel">
              <h2 className="panel__title">초대하기</h2>
              <div className="members__form">
                <div className="field">
                  <span className="field__label">이메일</span>
                  <div className="field__control">
                    <div className={`field__input lp-input${email ? '' : ' lp-placeholder'}`}>
                      {email || 'name@example.com'}
                      {email && !sent && t < ROLE && <Caret />}
                    </div>
                  </div>
                </div>
                <div className="members__roles">
                  <span className="field__label">역할</span>
                  <div className="segmented segmented--wide">
                    <button type="button" role="radio" aria-checked={!viewer || sent}>
                      편집자
                    </button>
                    <button type="button" role="radio" aria-checked={viewer && !sent}>
                      보기 전용
                    </button>
                  </div>
                  <p className="panel__label">편집자는 원고를 고칠 수 있고, 보기 전용은 읽기만 할 수 있어요.</p>
                </div>
                <button type="button" className={`btn btn--primary${t >= SEND && !sent ? ' btn--busy' : ''}`}>
                  초대 보내기
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppScreen>
  )
}

# Prolog Web

Figma "임시" 페이지 화면을 구현한 프론트엔드 (React + Vite + TypeScript). 백엔드는 별도 백엔드 팀이 만든 API를 붙인다.

## 실행

```bash
npm install
npm run dev
```

기본은 **브라우저 안의 목업 API**로 동작한다. 실제 백엔드를 붙일 때는 `.env.example`을 `.env`로 복사하고 `VITE_API_MODE=real`, `VITE_API_BASE_URL`을 바꾼다.

## 화면과 경로

| 경로 | Figma |
|---|---|
| `/auth` | 1173:2377 로그인 및 회원가입 시작 |
| `/auth/login` | 1173:2382 로그인 · 1214:2175 오류 |
| `/auth/signup` | 1214:2072 회원가입 |
| `/auth/signup/role` | 840:176 사용자 유형 선택 |
| `/auth/signup/verify` | 840:360 계정 인증 · 1214:2144 오류 |
| `/auth/find-id` | 840:433 · 1214:2224 아이디 찾기 |
| `/auth/reset-password` | 840:457 · 1214:2353 비밀번호 재설정 |
| `/projects` | 1260:2218 · 27 내 프로젝트 (사이드바 915:2343) |
| `/projects/new` | 1247:1989 새 프로젝트 |
| `/projects/:id` | 841:784 · 01 개요 |
| `/projects/:id/manuscripts` | 841:376 · 18 원고 업로드 |
| `/projects/:id/manuscripts/:msId` | 841:662 · 19 원고 편집기 |
| `/projects/:id/ask` | 842:579 · 02 AI 질문 · 35 답변 대기 · 36 답변 실패 |
| `/projects/:id/characters` | 842:863 · 20 등장인물 |
| `/projects/:id/characters/new` | 842:994 · 22 자연어로 인물 설계 |
| `/projects/:id/characters/drafts/:draftId` | 842:1115 · 23 초안 검토 · 37 병합 선택 |
| `/projects/:id/rules` | 843:1659 · 21 설정 규칙 |
| `/projects/:id/conflicts` | 843:1781 · 05 설정 충돌 검토 |
| `/projects/:id/relationships` | 843:1109 · 13 관계 변화 · 38 덮어쓰기 확인 |
| `/projects/:id/foreshadowings` | 843:1394 · 04 복선 추적 · 843:1534 · 24 복선 타임라인 |
| `/projects/:id/story-map` | 843:1243 · 03 스토리 지도 |
| `/projects/:id/members` | 1260:2438 · 28 프로젝트 멤버 |
| `/teams/new` | 843:2082 · 25 새 팀 만들기 |
| `/teams/:teamId` | 843:2184 · 26 팀 작업공간 |
| `/teams/:teamId/members` | 1260:2672 · 29 팀원과 초대 |
| `/notifications` | 1261:2571 · 30 알림 |
| `/settings/notifications` | 1261:2820 · 31 알림 설정 |
| `/projects/:id/manuscripts/:msId/history` | 1261:3042 · 32 원고 편집 이력 |

## 목업 테스트 계정

`src/api/mock/db.ts`의 시드 데이터. 목업 DB는 localStorage(`prolog.mock-db.v2`)에 저장되며, 지우면 초기화된다.

- 아이디/비밀번호: `writer_kim` 또는 `writer.kim@example.com` / `prolog1234` (이름 `김유진`)
- Google 로그인: 가입된 데모 계정으로 바로 로그인
- 네이버 로그인: 미가입 상태 → 회원가입으로 안내
- `writer_kim`은 예시 프로젝트 8개(개인 4·팀 4)를 갖고 있고, Google 데모 계정은 프로젝트가 없어 빈 상태를 볼 수 있다
- 협업 화면용 예시 팀원: `hm_lee`(이형민), `seoyeon`(박서연), `daeun`(정다은) — 비밀번호는 모두 `prolog1234`
- `writer_kim`에게는 안 읽은 초대 알림 2건(이형민의 팀 "밤의 서재", 박서연의 프로젝트 "푸른 등대")이 있어 알림 화면에서 바로 참가해 볼 수 있다

인증 코드(가입·비밀번호 재설정)는 실제 메일 대신 **브라우저 콘솔**에 `[mock] … 인증 코드` 로 출력된다.

시연용 작품 **"붉은 문 너머"**(`proj_1`)에는 원고 3개(27장), 인물, 관계, 설정 충돌, 복선, 스토리 지도, 설정 규칙 예시가 들어 있다(`src/api/mock/demo.ts`). 원고 파일 업로드는 3초 뒤 완료되며, 파일 이름에 "실패"나 "fail"이 들어가면 추출 실패를 흉내 낸다. txt 파일은 "1장", "제2장" 같은 줄을 기준으로 장을 나눈다. AI 질문·인물 추출은 문장에 `[실패]`를 넣으면 실패 화면을 시연할 수 있다. 설정 충돌 검사는 확정된 규칙의 위반 판정 키워드로 원고 문장을 찾는다(예: 27장에 "윤서는 비가 오는 중에 붉은 문을 열었다."를 쓰고 R11을 확정한 뒤 다시 검사).

## 백엔드 팀과 맞출 것 — API 명세와 다른 점

프론트가 호출하는 API는 `src/api/*.ts`에 모여 있다. 백엔드가 준비되면 `.env`에서 `VITE_API_MODE=real`로 바꾸면 된다.

AUTH 명세(v0.2는 Google 단독)가 아니라 Figma 기준으로 만들었다. `src/api/auth.ts`에서 "(명세 미정의)"로 표시한 부분:

- `POST /auth/email/verification`, `signup.verification_code` — 가입 전 이메일 인증
- `POST /auth/login`의 `login_id` — 아이디 **또는 이메일**로 로그인
- `POST /auth/username/find` — 아이디 찾기 (회원가입에 이름 입력 칸이 없어 이름 저장 경로가 없음)
- `POST /auth/password/reset-request`·`reset`의 `login_id` — 아이디 또는 이메일로 재설정 요청
- 소셜 로그인은 실제 OAuth 리다이렉트 없이 인가 코드를 흉내 낸다 (`mockOAuthCode`)

PRJ (`src/api/projects.ts`, `src/api/types.ts`):

- `GET /projects` 응답의 `team_name`, `my_role` — 카드의 "팀 · 문장 수집소" 배지와 소유자·편집자·보기 전용 배지
- `GET /projects?sort=updated_desc|created_desc|title_asc` — "최근 수정순" 정렬 (페이지네이션 때문에 서버 정렬 필요)
- `meta.counts = { all, personal, team }` — 탭의 "전체 5 · 개인 2 · 팀 3"
- `Project.description` — 개요 화면의 작품 소개 한 줄
- `GET /projects/{id}/overview` — 개요 화면 요약(현재 원고, 이야기 구조, 미해결 충돌·복선 수, 최근 관계도, 우선 검토 항목). 명세에 대시보드용 API가 없음
- 팀 프로젝트를 만들 때 고를 팀 목록은 TEAM `GET /teams` 사용 (Figma 새 프로젝트 화면에는 팀 선택 칸이 없어 추가)
- 멤버 목록의 사용자 이름·이메일을 `ProjectMember.name`, `ProjectMember.email`로 가정 (명세는 "사용자 이름 포함"만 적혀 있음)
- Figma 28 "보낸 초대"를 위해 `GET /projects/{id}/invitations` 필요 (명세에 없음). 취소한 초대(`revoked`)는 목록에서 뺌
- `ProjectInvitation.expires_at`(7일)과 만료 초대 수락 시 410 `INVITATION_EXPIRED`는 TEAM 명세를 따라 가정. "다시 초대"는 같은 이메일로 `POST /invitations`를 다시 보내 기한을 늘림
- 초대 응답 `meta.is_registered` — 미가입 이메일이면 "회원가입 안내와 함께" 문구를 보여 주기 위함
- 역할 변경·내보내기는 목업에서 owner만 가능. 초대는 owner·editor (명세 5장 처리 흐름 기준)

MSU·AIQ (`src/api/manuscripts.ts`):

- `Manuscript.file_size`, `Manuscript.char_count` — 업로드 목록의 "1.8MB", "82,420자" 표시
- 파일 업로드본 원고도 편집기에서 수정·자동 저장(`PATCH .../chapters/{id}`)할 수 있다고 가정 (Figma 19가 DOCX 원고를 편집)
- AIQ `selection_range`와 함께 `chapter_id`를 보낸다 — 명세의 범위는 원고 전체 기준 오프셋이라 장 단위 편집기와 맞지 않음
- `QAThread.selected_text`, `QAThread.cited_chapters`, `QAMessage.citations`(근거 장·인용문) — Figma 02의 "근거 · 17장 / 원문 보기"
- 편집 이력(4.10 `GET .../versions`)은 명세에 필드가 없어 `ManuscriptVersion`(장 단위 스냅샷: `chapter_no`, `reason`=edit·autosave·file_upload·import, `label`, `char_count`)으로 가정. 목록은 cursor 페이지네이션 + `meta.total`("스냅샷 12개")
- 스냅샷 본문 조회 `GET .../versions/{versionId}`는 명세에 없음. 스냅샷을 언제 남기는지(목업: 같은 장을 10분 안에 이어 고치면 하나로 합침)도 백엔드와 맞출 것

NLCD·ASS·인물 (`src/api/characters.ts`):

- NLCD 요청의 `character_name` — Figma 22 "인물 이름" 입력 (명세는 source_text만 받음)
- 초안 항목의 `evidence` — 추출 근거를 초안 검토 화면에서 보여 줌 (ASS 명세에는 없음)
- `Character.role_label`·`status_label`·`last_chapter`·`relationship_count`·`key_changes` — Figma 20 등장인물 목록·상세
- `DELETE /projects/{id}/characters/{characterId}` — 관계가 남아 있으면 409 `CHARACTER_HAS_DEPENDENT_RELATIONSHIPS` + 관계 목록
- 초안 항목은 카테고리별 배열 대신 `items[]` 한 줄로 받고 `field`로 구분 (내용은 명세와 같음)

REX·SCDS (`src/api/world.ts`):

- `WorldRule.code`·`title`·`status`(confirmed/pending/ignored) — 명세는 후보를 추출 작업 결과에만 두지만, Figma 21은 후보와 확정 규칙을 한 목록에서 다룸
- `POST /world-rules/{id}/confirm`·`/ignore` — 후보 하나씩 확정·무시 (명세는 `rule-extractions/{id}/confirm`에 `selected_indices`로 한꺼번에)
- `Conflict.evidence[]`(두 근거) — Figma 05는 원고의 두 장면을 비교하는데, 명세의 Conflict는 입력 사건 하나와 설정 항목 하나만 가짐
- `POST /projects/{id}/rescan` — 명세의 챕터 단위 재검사(SCDS-007)를 프로젝트 전체로 사용. 사건(Event) 입력 화면이 Figma에 없어 이 경로로 검사를 시작함
- "직접 수정"(`modified`)이면 원고의 해당 문장을 고친 문장으로 바꿈 (명세는 `modified_content`만 저장)

RCV (`src/api/relationships.ts`):

- 기록의 원인 사건을 `event_id` 대신 `event_title`(이름)로 받음 — 사건(Event) 리소스가 아직 없어서
- 두 인물 사이에 관계가 이미 있으면 409 `RELATIONSHIP_EXISTS` (명세에 없음)
- 마인드맵 엣지에 `is_carried_forward`·`resolved_chapter`를 함께 돌려줌

TEAM (`src/api/teams.ts`):

- `Team.my_role`, `Team.project_count`, `Team.pending_invitation_count` — Figma 26 "팀원 04명 · 초대 대기 1 · 팀 프로젝트 03개"와 관리 버튼 노출용
- `TeamMember.name`, `TeamMember.email` 가정 (명세는 "사용자 이름 포함"만)
- `GET /teams/{id}/invitations`는 명세상 "대기 중인 초대"지만 Figma 29가 만료된 초대(다시 초대)도 보여 줘서 `pending`·`expired`를 함께 돌려줌
- "다시 초대"는 같은 이메일로 `POST /invitations`를 다시 보내 기한을 7일로 늘림
- 역할 변경은 목업에서 owner만 가능, admin은 member만 내보낼 수 있음 (명세 4.11·4.12에 세부 권한 없음)
- "작업 중 N"은 최근 7일 안에 수정된 팀 프로젝트 수로 화면에서 계산
- 팀원이 되어도 팀 프로젝트에 자동으로 참여하지는 않음(프로젝트 멤버 초대가 따로 필요). PRJ 4.1 "개인 + 참여 팀" 범위를 백엔드와 맞출 것

NOTI (`src/api/notifications.ts`):

- 초대 알림의 `related_ref`에 `parent_id`(팀·프로젝트 ID), `status`, `expires_at`을 더해 돌려줌 — 알림에서 바로 "참가"(TEAM 4.9 / PRJ 4.8)하고 "만료까지 6일"을 보여 주려면 필요. 명세의 `{type, id}`만으로는 수락 API 경로를 만들 수 없음
- `PATCH /notifications/{id}`에 `{ read: false }`도 허용(안 읽음으로 되돌리기) — 명세는 `read: true`만 예시
- 서비스 알림을 끈 유형은 인앱 목록에 넣지 않음. 이메일은 연동 계정이 있고 설정이 켜져 있을 때만 `channels_sent`에 `email` 기록
- 실시간 채널이 없어 사이드바의 안 읽은 수는 화면을 옮길 때마다 다시 불러옴
- 목업 이메일 연동은 OAuth 없이 아이디로 주소를 만든다(`아이디@gmail.com`). `oauth_code`에 "fail"이 들어가면 502 `OAUTH_PROVIDER_ERROR`

FTS (`src/api/foreshadowings.ts`):

- `Foreshadowing.code`("F01") 표시 번호, 관련 인물·사건을 ID 대신 이름(`linked_characters`, `linked_events`)으로 보관
- 미회수 안내에 `elapsed_chapters`를 함께 돌려줌. 현재 장은 가장 최근 원고의 장 수로 계산
- 비슷한 복선 안내에서 "기존에 연결"을 고르면 새 복선을 지우고 설치 장을 기존 복선의 연결 장으로 옮김 (화면 쪽 처리)

SSM (`src/api/story.ts`):

- 구조 분석 작업은 `analysis_id`로 조회(다른 비동기 작업의 `job_id`와 이름이 다름). 목업은 3초 뒤 완료, `simulate_failure: true`로 실패 시연
- 내용이 있는 장이 3개 미만이면 422 `MANUSCRIPT_TOO_SHORT` (최소 분량 기준은 명세에 없음)
- 노드의 관련 인물을 `character_id` 대신 이름(`characters`)으로 돌려줌
- 노드 수정(`PATCH …/structure-map/nodes/:nodeId`)은 제목·요약만 받음. 다시 분석해도 사용자가 고친 지도는 유지
- 화면은 장이 가장 많은 원고를 기본 분석 대상으로 고르고, 복선 연결은 그 본편 지도에서만 보여 줌 (복선의 장 번호가 어느 원고 기준인지 명세에 없음)

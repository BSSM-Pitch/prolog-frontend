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
| `/projects/:id/…` | 원고·인물·관계·복선 등은 순서대로 구현 중 (준비 중 안내) |

## 목업 테스트 계정

`src/api/mock/db.ts`의 시드 데이터. 목업 DB는 localStorage(`prolog.mock-db.v1`)에 저장되며, 지우면 초기화된다.

- 아이디/비밀번호: `writer_kim` 또는 `writer.kim@example.com` / `prolog1234` (이름 `김유진`)
- Google 로그인: 가입된 데모 계정으로 바로 로그인
- 네이버 로그인: 미가입 상태 → 회원가입으로 안내
- `writer_kim`은 예시 프로젝트 8개(개인 4·팀 4)를 갖고 있고, Google 데모 계정은 프로젝트가 없어 빈 상태를 볼 수 있다

인증 코드(가입·비밀번호 재설정)는 실제 메일 대신 **브라우저 콘솔**에 `[mock] … 인증 코드` 로 출력된다.

시연용 작품 **"붉은 문 너머"**(`proj_1`)에는 원고 3개(27장), 인물, 관계, 설정 충돌, 복선, 스토리 지도, 설정 규칙 예시가 들어 있다(`src/api/mock/demo.ts`). 원고 파일 업로드는 3초 뒤 완료되며, 파일 이름에 "실패"나 "fail"이 들어가면 추출 실패를 흉내 낸다. txt 파일은 "1장", "제2장" 같은 줄을 기준으로 장을 나눈다. AI 질문·인물 추출은 문장에 `[실패]`를 넣으면 실패 화면을 시연할 수 있다.

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

MSU·AIQ (`src/api/manuscripts.ts`):

- `Manuscript.file_size`, `Manuscript.char_count` — 업로드 목록의 "1.8MB", "82,420자" 표시
- 파일 업로드본 원고도 편집기에서 수정·자동 저장(`PATCH .../chapters/{id}`)할 수 있다고 가정 (Figma 19가 DOCX 원고를 편집)
- AIQ `selection_range`와 함께 `chapter_id`를 보낸다 — 명세의 범위는 원고 전체 기준 오프셋이라 장 단위 편집기와 맞지 않음
- `QAThread.selected_text`, `QAThread.cited_chapters`, `QAMessage.citations`(근거 장·인용문) — Figma 02의 "근거 · 17장 / 원문 보기"

NLCD·ASS·인물 (`src/api/characters.ts`):

- NLCD 요청의 `character_name` — Figma 22 "인물 이름" 입력 (명세는 source_text만 받음)
- 초안 항목의 `evidence` — 추출 근거를 초안 검토 화면에서 보여 줌 (ASS 명세에는 없음)
- `Character.role_label`·`status_label`·`last_chapter`·`relationship_count`·`key_changes` — Figma 20 등장인물 목록·상세
- `DELETE /projects/{id}/characters/{characterId}` — 관계가 남아 있으면 409 `CHARACTER_HAS_DEPENDENT_RELATIONSHIPS` + 관계 목록
- 초안 항목은 카테고리별 배열 대신 `items[]` 한 줄로 받고 `field`로 구분 (내용은 명세와 같음)

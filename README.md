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
| `/projects/new`, `/projects/:id` | 준비 중 안내 (1247:1989 새 프로젝트, 841:784 개요) |

## 목업 테스트 계정

`src/api/mock/db.ts`의 시드 데이터. 목업 DB는 localStorage(`prolog.mock-db.v1`)에 저장되며, 지우면 초기화된다.

- 아이디/비밀번호: `writer_kim` 또는 `writer.kim@example.com` / `prolog1234` (이름 `김유진`)
- Google 로그인: 가입된 데모 계정으로 바로 로그인
- 네이버 로그인: 미가입 상태 → 회원가입으로 안내
- `writer_kim`은 예시 프로젝트 8개(개인 4·팀 4)를 갖고 있고, Google 데모 계정은 프로젝트가 없어 빈 상태를 볼 수 있다

인증 코드(가입·비밀번호 재설정)는 실제 메일 대신 **브라우저 콘솔**에 `[mock] … 인증 코드` 로 출력된다.

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

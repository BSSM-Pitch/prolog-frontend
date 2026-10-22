# Prolog 디자인 시스템 (Sky)

밝은 화면과 넓은 여백, 큰 라운드를 쓰는 플랫 디자인입니다. 목표는 **잘 읽히고 믿음이 가는 화면**입니다.

- 하늘색 구름 사진을 배경으로 쓰고, 선명한 블루는 행동 유도(CTA)에만 아껴 씁니다.
- 블랙은 대비를 주는 보조 액센트입니다.
- 그림자는 거의 쓰지 않습니다. 영역은 연한 회색 면으로 나눕니다.

모든 값은 [`src/styles/tokens.css`](src/styles/tokens.css)에 있습니다. 화면 CSS에는 색, 간격, 라운드를 직접 쓰지 않고 토큰만 씁니다.

---

## 1. 원칙

1. **블루는 한 화면에 하나의 주요 행동에만.** 링크, 선택 상태, 장식에는 블루를 쓰지 않습니다. 예외는 초점 링, 정보 배지(★ 평점형), 진행 막대, 토글 켜짐입니다.
2. **선택과 강조는 블랙으로.** 현재 메뉴는 블랙 원 아이콘으로 표시합니다. 선택된 목록 항목은 블랙 1px 테두리, 필터의 켜진 칩은 블랙 바탕입니다.
3. **영역은 면으로 나눕니다.** 카드는 회색 면(`--color-surface`)에 큰 라운드를 줍니다. 테두리와 그림자는 기본적으로 쓰지 않습니다.
4. **면 위의 면은 색을 뒤집습니다.** 회색 패널 안의 요소는 흰 면, 흰 면 안의 요소는 회색 면으로 둡니다. 같은 색을 겹치지 않습니다(§8).
5. **한글 가독성이 우선입니다.** 어절 단위로 줄을 바꾸고, 본문은 1.6 이상의 행간을 씁니다. 대문자와 Title Case는 영문 라벨에만 씁니다.

---

## 2. 컬러

### 기본

| 역할 | 토큰 | 값 | 쓰는 곳 |
|---|---|---|---|
| Primary | `--color-primary` | `#2F80ED` | CTA 버튼, 정보 배지, 초점, 진행 막대 |
| Primary Hover | `--color-primary-hover` | `#1F6FDC` | Primary 버튼 hover |
| Primary Light | `--color-primary-50` | `#E8F1FD` | 초점 링, 선택 카드 바탕, 안내 면 |
| Dark | `--color-dark` | `#111111` | Dark 버튼, 현재 메뉴, 선택 표시, 질문 말풍선 |
| Dark Hover | `--color-dark-hover` | `#2A2A2A` | Dark 버튼 hover |
| Text 1 | `--color-text-1` | `#111111` | 제목, 본문 |
| Text 2 | `--color-text-2` | `#6B7280` | 설명문, 보조 정보 (흰 바탕 대비 4.8:1) |
| Text 3 | `--color-text-3` | `#A0A6AE` | eyebrow, 캡션, 비활성. **본문에는 쓰지 않습니다** |
| Surface | `--color-surface` | `#F5F7FA` | 패널, 카드, 회색 버튼 |
| Surface 2 | `--color-surface-2` | `#EEF1F5` | 회색 면의 hover, 회색 면 위의 트랙 |
| Sky | `--color-sky` | `#DCEAF5` | 아바타, 구름 이미지가 로드되기 전 바탕 |
| Border | `--color-border` | `#E6EAF0` | 입력칸, 구분선, outline 버튼 |
| Border Strong | `--color-border-strong` | `#D3D9E1` | hover 테두리, 점선 업로드 영역, 연결선 |
| Background | `--color-bg` | `#FFFFFF` | 페이지 바탕, 패널 안의 항목 |

### 상태

| 역할 | 글자 | 바탕 |
|---|---|---|
| 오류·삭제 | `--color-danger` `#D92D20` | `--color-danger-50` `#FDECEB` |
| 완료·연결됨 | `--color-success` `#12875A` | `--color-success-50` `#E5F5EE` |
| 대기·주의 | `--color-warning` `#B54708` | `--color-warning-50` `#FDF3E8` |

상태 색은 항상 연한 바탕과 진한 글자를 짝으로 씁니다.

### 예외적으로 고정값을 쓰는 곳

- **브랜드 마크:** Google과 네이버 로그인 마크는 각 서비스의 이미지를 그대로 씁니다(`src/assets/social/`).
- **구름 위 텍스트:** 구름 사진 위의 글자는 `rgba(17,17,17,.6~.72)`, 구름 위 흰 카드는 `rgba(255,255,255,.9)`를 씁니다.
- **블루 카드 안의 글자:** 흰색 `#fff`와 `rgba(255,255,255,.78)`를 씁니다.

---

## 3. 타이포그래피

```css
--font-sans: 'DM Sans', 'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif;
```

- 영문과 숫자는 **DM Sans**, 한글은 **Pretendard**가 맡습니다. DM Sans에는 한글이 없어서 글자마다 자동으로 Pretendard로 넘어갑니다.
- 글꼴은 `index.html`에서 불러옵니다(Google Fonts, jsdelivr).

| 스타일 | 클래스 | 크기 / 행간 | 굵기 | 비고 |
|---|---|---|---|---|
| Display | `.t-display` | 64px / 1.15 | 600 | 히어로 헤드라인, 자간 -0.02em. 720px 이하 40px |
| Display Caps | `.t-display-caps` | 56px / 1.2 | 500 | 영문 대문자, 자간 +0.02em ("START YOUR STORY") |
| H2 | `.t-h2`, `.page-title` | 36px / 1.3 | 500 | 섹션·화면 제목. 720px 이하 28px |
| H3 | `.t-h3`, `.panel__title` | 20px / 1.4 | 500 | 카드 제목 |
| Body | `.t-body`, `.page-desc` | 15px / 1.6 | 400 | 설명문, Text 2 |
| Caption | `.t-caption` | 12px / 1.5 | 400 | 날짜, 위치, 메타 |
| Eyebrow | `.eyebrow` | 12px / 1.5 | 500 | 영문 대문자, 자간 +0.08em, Text 3 |
| 원고 본문 | `.editor__text` | 17px / 1.85 | 400 | 한 줄 최대 68ch |

### 한글 규칙

- **줄바꿈:** `body`에 `word-break: keep-all`을 둬서 어절 단위로 줄을 바꿉니다.
- **자간:** 제목(`h1~h3`)은 자간 -0.01em으로 조금 조입니다.
- **영문 라벨:** 대문자 eyebrow와 내비게이션은 영문(`ABOUT`, `HOW IT WORKS`, `LEARN MORE →`)으로만 씁니다. 한글 문장에는 대문자나 Title Case를 적용하지 않습니다.

---

## 4. 간격 · 레이아웃

8pt 그리드를 따릅니다.

| 토큰 | 값 | | 토큰 | 값 |
|---|---|---|---|---|
| `--space-1` | 4px | | `--space-8` | 32px |
| `--space-2` | 8px | | `--space-10` | 40px |
| `--space-3` | 12px | | `--space-12` | 48px |
| `--space-4` | 16px | | `--space-16` | 64px |
| `--space-5` | 20px | | `--space-section` | 140px (랜딩 섹션 사이, 860px 이하 96px) |
| `--space-6` | 24px | | | |

### 컨테이너

| 영역 | 규칙 |
|---|---|
| 랜딩 | `min(1200px, 100% - 거터×2)`. 거터는 `clamp(16px, 5vw, 120px)` |
| 앱 작업 영역 | `.app__inner`, 최대 1200px. 좌우 패딩은 48px(1440px 이상 64px), 960px 이하 24px, 640px 이하 16px |

### 격자

| 쓰는 곳 | 구성 |
|---|---|
| 카드 목록 | 3열, 간격 32px. 1280px 이하 2열, 720px 이하 1열 |
| 목록 + 상세 | `.two-col--list`: `minmax(300px, 1fr) minmax(0, 1.6fr)` |
| 작업 + 보조 | 원고, 편집기: `2fr / 1fr` |
| 공통 | 1100px 이하에서 모두 1열 |

---

## 5. 라운드 · 그림자 · 모션

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--radius-sm` | 12px | 작은 입력칸 |
| `--radius-md` | 16px | 입력칸, 목록 항목, 패널 안의 박스 |
| `--radius-lg` | 24px | 패널, 카드, 카드 이미지, 다이얼로그 |
| `--radius-xl` | 48px | 히어로, 구름 머리글, CTA 바, 인증 패널 |
| `--radius-full` | 9999px | 버튼, 배지, 필터, 검색칸 |

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--shadow-soft` | `0 8px 24px rgba(17,17,17,.06)` | **다이얼로그에만** |
| `--focus-ring` | `0 0 0 4px var(--color-primary-50)` | 입력칸 초점 (테두리는 primary) |
| `--ease` | `cubic-bezier(.22, 1, .36, 1)` | 사이드바 접기, 카드 진입 |
| `--transition-state` | `160ms ease` | hover, 상태 변화 |

- **초점 표시:** 키보드 초점은 모든 조작 요소에 `outline: 2px solid var(--color-primary); outline-offset: 2px`를 씁니다.
- **모션 감소:** `prefers-reduced-motion` 설정이면 랜딩의 등장 효과(`Reveal`)와 인증 패널 애니메이션을 끕니다.

---

## 6. 이미지

| 파일 | 쓰는 곳 |
|---|---|
| `public/brand/clouds/sky-hero.webp` | 랜딩 히어로, 프로젝트 목록 머리글. 아래쪽에 구름이 있고 위쪽이 하늘이라 글자를 올리기 좋음 |
| `public/brand/clouds/sky-band.webp` | 구름 CTA 바 |
| `public/brand/clouds/sky-soft.webp` | 인증 패널, 빈 상태 원형 썸네일, 프로세스 카드의 원형 사진 |

- **출처:** 세 장 모두 Unsplash License이며, 출처는 [`public/brand/clouds/CREDITS.md`](public/brand/clouds/CREDITS.md)에 있습니다.
- **카드 썸네일:** `skyThumb(id)`([`src/lib/sky.ts`](src/lib/sky.ts))를 씁니다. 같은 id면 늘 같은 사진과 같은 자리를 잘라 씁니다.
- **실존 회사 로고:** 쓰지 않습니다. 파트너 바 자리에는 글 형식(웹소설·장편소설·시나리오…)을 회색 워드마크로 둡니다.

---

## 7. 컴포넌트

공용 스타일은 [`src/components/ui.css`](src/components/ui.css)에 있습니다.

### 버튼: `Button` / `.btn`

모든 버튼은 높이 48px의 알약형입니다.

| tone | 모양 | 쓰는 곳 |
|---|---|---|
| `primary` | 블루 바탕 + 흰 글씨 | 화면의 주요 행동 하나 |
| `ink` | 블랙 바탕 + 흰 글씨 | 내비게이션 "시작하기", 보조 강조 |
| `secondary`, `soft` | 회색 면 + 검은 글씨 | 일반 행동 (패널 안에서는 흰 면) |
| `outline` | 흰 바탕 + Border | 취소, 보조 |
| `outline-strong` | 흰 바탕 + 블랙 테두리 | 강조된 보조 |
| `error` | 연빨강 바탕 + 빨강 글씨 | 삭제, 나가기 |

| size | 높이 | 쓰는 곳 |
|---|---|---|
| `md` | 48px | 기본 |
| `lg` | 56px | 로그인 폼, 히어로 CTA |
| `xl` | 64px | 화면의 마지막 주요 행동 |

- **비활성:** 회색 면에 Text 3 글자입니다.
- **요청 중(`busy`):** 투명도 0.75로 낮춥니다.
- **640px 이하:** 버튼 글자가 줄을 바꿀 수 있습니다.

### 원형 아이콘 버튼: `IconButton` / `.icon-btn`

- **크기:** 48px 원이며, `sm`은 36px입니다.
- **모양:** `outline`은 흰 바탕에 연회색 테두리, `filled`는 블랙으로 채운 강조형입니다.
- **이름:** 아이콘만 보이므로 `label`(스크린 리더 이름)이 꼭 필요합니다.

### 입력: `TextField`, `TextArea`

- **기본:** 흰 면, Border 1px, `--radius-md`, 높이 48px(`lg`는 56px)입니다.
- **상태:**

  | 상태 | 모양 |
  |---|---|
  | hover | Border Strong 테두리 |
  | 초점 | primary 테두리 + `--focus-ring` |
  | 오류 | danger 테두리 + 연빨강 링 |
  | 비활성 | 회색 면 |

- **select:** 목록 화면의 select는 알약형(`--radius-full`)입니다.
- **드롭다운:** 브라우저 기본 `<select>`는 OS 스타일(macOS 리퀴드 글래스)로 열려서 쓰지 않고, `Select`([`src/components/Select.tsx`](src/components/Select.tsx))를 씁니다. `<select>`와 같은 방식(`value`, `onChange`, `<option>` 자식)으로 쓰고, 목록은 흰 면 + Border + `--shadow-soft`, 항목은 40px, 활성 항목은 회색 면, 선택된 항목은 굵은 글씨 + 체크입니다. 키보드(↑↓ Enter Esc Home End)를 지원합니다.

### 선택 묶음: `.segmented`

- **모양:** 회색 알약 트랙 안에 흰 칩이 놓입니다. 선택된 칩은 흰 바탕 + Border 링입니다.
- **패널 안:** 트랙을 Surface 2로 바꿉니다.
- **프로젝트 필터:** 같은 트랙을 쓰지만, 켜진 칩은 블랙 바탕 + 흰 글씨입니다(`.projects__filter`).

### 기타

| 컴포넌트 | 클래스 | 모양 |
|---|---|---|
| 배지 | `.badge` | 26px 알약형. `--done`은 블루, `--waiting`·`--error`·`--success`는 상태 색 짝, `--filled`는 흰 바탕 + Border, `--outline`은 블랙 테두리 |
| 정보 배지 | `.card__badge`, `.project-card__badge` | 블루 알약 + 흰 글씨 (★ AI, 원고 3) |
| 토글 | `Toggle` / `.toggle` | 44×24. 꺼짐은 Border Strong, 켜짐은 블루 |
| 선택 카드 | `RoleGroup` / `.option` | 흰 면 + Border, 선택되면 primary 테두리 + primary-50 바탕 |
| 안내 | `.notice` | 기본은 글자만. `--block`은 회색 면 박스, 오류·완료는 상태 색 바탕 |
| 텍스트 링크 | `.text-link` | Text 2, hover 시 Text 1 + 밑줄 |
| 화살표 링크 | `.arrow-link` | 12px 영문 대문자 + `→`, hover 시 화살표가 3px 이동 |
| 확인 창 | `ConfirmDialog` / `.dialog` | 흰 면, `--radius-lg`, `--shadow-soft`, 배경막 `rgba(17,17,17,.24)` |
| 소셜 로그인 | `SocialButtons` / `.social__btn` | 56px 흰 outline 알약 + 24px 브랜드 마크 이미지 |
| 초대 링크 | `InviteLink` | 알약형 URL 칸 + 복사 버튼 |
| 로고 | `Logo` | 블랙 원 + 흰 P 마크 + "Prolog" 워드마크(DM Sans 600). `wordmark={false}`면 마크만 |

---

## 8. 화면 패턴

### 앱 골격 (`AppShell`, `Sidebar`)

- **사이드바:** 너비 280px(접힘 88px), 흰 바탕, 오른쪽에 Border 1px입니다. 960px 이하에서는 항상 접힙니다.
- **위에서 아래 순서:**
  1. 로고와 원형 접기 버튼
  2. 현재 프로젝트 카드 (회색 면, `PROJECT` eyebrow)
  3. 메뉴: 높이 44px 알약형입니다. 아이콘은 32px 원 안에 둡니다. 현재 화면이면 회색 면 + Dark 글씨 + **블랙 원 아이콘**입니다.
  4. 하위 메뉴: 왼쪽 세로 연결선 아래에 13px로 들여 씁니다.
  5. 맨 아래: 프로젝트 멤버, 그리고 계정(Sky 아바타 · 이름 · 역할 · 원형 로그아웃 버튼)
- **알림 수:** 블루 알약 배지입니다.

### 화면 머리글

- **기본:** `.page-crumb`(12px Text 3) → `.page-title`(H2) → `.page-desc`(Body)입니다. 주요 버튼은 오른쪽 위에 둡니다.
- **목록 첫 화면:** 프로젝트 목록처럼 첫 화면에 해당하는 곳은 구름 머리글을 씁니다. 구름 사진에 `--radius-xl`, 제목 48px, 오른쪽 아래에 primary `lg` 버튼을 둡니다.

### 패널과 목록

- **패널:** `.panel`은 회색 면, `--radius-lg`, 패딩 24px(640px 이하 20px)이고 테두리는 없습니다.
- **패널 안의 목록 항목:** 흰 면에 `--radius-md`를 줍니다. 테두리는 평소 투명, hover 때 Border Strong, **선택되면 Text 1(블랙)**입니다.
- **면 위의 면:**

  | 놓이는 곳 | 안쪽 요소 |
  |---|---|
  | 회색 패널 | 흰 면 (목록, 근거 카드, 상태 블록, 입력칸, 회색 버튼) |
  | 흰 종이 (편집기, 대화 영역) | 회색 면 (회색 버튼, 선택 문장 박스) |

- **표:** 머리글은 12px Text 3, 행 구분은 Border입니다. 640px 이하에서는 표가 가로로 스크롤됩니다.

### 카드 (목적지 카드 패턴)

라운드 이미지 아래에 정보를 둡니다.

- **이미지:** 구름 이미지에 `--radius-lg`, 높이 200~300px입니다.
- **제목 줄:** 왼쪽에 H3 제목, 오른쪽에 블루 정보 배지를 둡니다.
- **캡션:** 아이콘이 붙은 12px Text 2 메타입니다.
- **클릭 영역:** 카드 전체를 누를 수 있게 제목 링크의 `::after`가 카드를 덮습니다.

### 프로세스 카드 (3단계)

- **기본 카드:** 회색 면 + 흰 원형 아이콘(48~56px) + `STEP 0N` eyebrow + H3 + 설명입니다.
- **가운데 활성 카드:**
  - 블루 바탕에 흰 글씨이며, 다른 카드보다 위로 솟습니다(높이 차 32~48px).
  - 오른쪽 위에 원형 구름 사진이 잘려 들어가고, 사진 테두리는 블루 8px입니다.
  - 아래에 `LEARN MORE →`를 둡니다.
  - 카드 안의 버튼은 흰 바탕입니다.
- 앱의 개요 화면에서는 "다음 작업" 카드가 이 패턴을 따릅니다. 가장 먼저 할 일이 활성 카드입니다.

### 스테퍼

| 종류 | 쓰는 곳 | 모양 |
|---|---|---|
| 세로 | 랜딩 히어로, 새 팀 만들기 | 36~44px 번호 원 + 1px 연결선. 현재는 블랙, 완료는 블루 + ✓, 잠김은 흰 원 + Border |
| 가로 | 인물 설계 (`.stepper`) | 회색 알약 트랙 안. 완료는 블랙 원, 현재는 블루 원 + 굵은 글씨 |

### 상태 블록

- **빈 상태·불러오기·오류:** 회색 면 박스(패널 안에서는 흰 면)에 가운데 정렬입니다. 빈 상태에는 88px 원형 구름 썸네일 + H3 + 설명 + primary 버튼을 둡니다.
- **업로드 영역:** 흰 면 + Border Strong 1.5px 점선 + 원형 구름 썸네일입니다. 파일을 끌어 올리면 primary 테두리 + primary-50 바탕으로 바뀝니다.

### 대화 (AI 질문)

- **질문:** 블랙 말풍선 + 흰 글씨, 오른쪽 정렬입니다. 오른쪽 아래 모서리만 6px입니다.
- **답변:** 회색 면, 왼쪽 정렬입니다. 왼쪽 아래 모서리만 6px입니다.
- **근거 인용:** 흰 면 + Border 박스입니다.

### 랜딩 구조

1. **내비게이션:** 로고 / 대문자 메뉴 4개(ABOUT · FEATURES · PROCESS · START) / 로그인 링크 + Dark "시작하기" 버튼. 고정되며 반투명 흰 바탕입니다.
2. **히어로:**
   - 구름 사진 카드(`--radius-xl`) 위에 왼쪽 정렬 Display 헤드라인을 올립니다.
   - 왼쪽에 세로 스테퍼 1·2·3이 있고, 누르면 문구가 바뀝니다.
   - 오른쪽 아래 노치는 페이지 바탕색 블록과 `radial-gradient`로 판 두 개의 안쪽 둥근 모서리로 만듭니다. 그 안에 Know More 카드와 겹친 아바타 3개를 둡니다.
3. **형식 바:** `MADE FOR` 필(원형 아이콘 3개) + 회색 워드마크
4. **기능 카드:** 좌우로 넘기는 3열 카드, 원형 화살표 버튼으로 이동
5. **3단계 프로세스 카드**
6. **베타 안내:** 회색 박스 안에 블루 대형 숫자(128px) + 혜택 목록 + primary 버튼
7. **CTA 바:** 구름 배경 + Display Caps + 블랙 원형 화살표 버튼
8. **푸터:** 로고, 3열 링크, 저작권

### 인증 패널

- **기본:** 오른쪽에서 흰 패널이 밀려 나옵니다. 왼쪽 모서리는 `--radius-xl`이고 그림자는 없습니다. 배경막은 `rgba(17,17,17,.24)`입니다.
- **화면을 채우는 단계(`-full`):** 왼쪽 절반은 구름 사진 카드, 오른쪽은 폼입니다. 960px 이하에서는 폼만 보입니다.
- **폼:** 너비 440px, 테두리와 바탕이 없고, 제목은 H2입니다.

---

## 9. 반응형

| 너비 | 바뀌는 것 |
|---|---|
| ≤ 1280px | 카드 목록 3열 → 2열 |
| ≤ 1100px | 두 칸 화면이 1열로 쌓임. 랜딩 기능 카드 2장씩 |
| ≤ 960px | 사이드바 항상 접힘(88px). 인증 패널이 화면을 채움 |
| ≤ 860px | 랜딩 메뉴 숨김. 히어로 스테퍼가 가로로 바뀌고 노치 카드는 히어로 아래로. 섹션 간격 96px |
| ≤ 720px | 제목 크기 축소, 카드 1열 |
| ≤ 640px | 작업 영역 패딩 16px, 격자 칸 `min-width: 0`, 표 가로 스크롤, 버튼 글자 줄바꿈 허용 |

375px와 768px에서 가로 스크롤이 생기지 않아야 합니다. 터치 대상은 44px 이상으로 둡니다.

---

## 10. 새 화면을 만들 때 점검할 것

- [ ] 색, 간격, 라운드에 토큰만 썼는가 (`#hex`, `px` 라운드 직접 쓰지 않기)
- [ ] 블루가 그 화면의 주요 행동 하나에만 쓰였는가
- [ ] 선택 상태를 블랙(테두리, 바탕, 원)으로 표시했는가
- [ ] 회색 면 위에 회색 요소를 겹치지 않았는가
- [ ] 그림자는 다이얼로그 말고는 쓰지 않았는가
- [ ] 머리글이 crumb → H2 → 설명 순서인가
- [ ] 본문에 Text 3을 쓰지 않았는가
- [ ] 키보드 초점이 보이는가
- [ ] 375px에서 가로로 넘치지 않는가

---

## 11. 파일 위치

| 무엇 | 파일 |
|---|---|
| 토큰 | `src/styles/tokens.css` |
| 기본 스타일 · 한글 규칙 | `src/index.css` |
| 타이포 · 머리글 · 패널 · 배지 | `src/styles/app.css` |
| 공용 컴포넌트 | `src/components/ui.css`, `Button.tsx`, `IconButton.tsx`, `TextField.tsx`, `TextArea.tsx`, `Toggle.tsx`, `ConfirmDialog.tsx`, `SocialButtons.tsx`, `InviteLink.tsx`, `RoleOption.tsx`, `Logo.tsx` |
| 앱 골격 | `src/features/app/AppShell.css`, `Sidebar.tsx` |
| 랜딩 | `src/features/landing/landing.css`, `sections/*`, `Reveal.tsx` |
| 인증 패널 | `src/features/auth/AuthShell.css` |
| 구름 썸네일 | `src/lib/sky.ts` |
| 이미지 | `public/brand/clouds/` |
| 글꼴 | `index.html` |

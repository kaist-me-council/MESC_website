# 사이트 설정(Site Settings) 관리 기능 — 설계 문서

- **작성일**: 2026-06-02
- **목표**: 현재 코드에 하드코딩되어 관리자가 수정할 수 없는 사이트 콘텐츠(운영시간 / 연락처·위치 / 외부링크·SNS / 동아리 소개)를 관리자 페이지에서 직접 편집 가능하게 한다.
- **배경**: 개발이 얼추 끝난 상태에서 **운영 편의성**을 높이는 것이 우선순위. 기존 관리자 시스템은 "콘텐츠 종류마다 DB 모델 + 관리자 페이지" 패턴(PopupSettings/PopupLink/Member 등)을 사용하므로, 이를 그대로 확장한다.

## 1. 범위

관리자가 편집 가능하게 만들 대상 (4가지, 전부 한/영 입력 지원):

| 콘텐츠 | 현재 하드코딩 위치 |
|---|---|
| 운영 시간 (요일별 구조화) | `components/home-client.tsx` (평일 09–18, 점심 12–13, 주말 휴무) |
| 연락처·위치 | `components/Footer.tsx` (N7동 학생회실, kaist.mesc@gmail.com) |
| 외부 링크·SNS | `lib/links.ts` (IMPORTANT_LINKS 3개 + COMMUNITY_LINKS 4개) |
| 동아리 소개 | `app/members/members-client.tsx` (MR, 질주 2개) |

**범위 밖(이번 작업 제외)**: 캘린더/커뮤니티/카테고리 등 UI 라벨 문자열(이미 i18n 처리됨, 운영 편의성 영향 낮음).

## 2. 데이터 모델 (Prisma)

기존 컨벤션: 싱글톤은 `id @default(1)`, 리스트는 `autoincrement` + `order` + `enabled` + `*En` 필드.

```prisma
// 싱글톤 — 운영시간 + 연락처 (PopupSettings 패턴)
model SiteSettings {
  id         Int      @id @default(1)
  locationKo String   @default("N7동 학생회실")
  locationEn String   @default("Student Council Room, N7")
  email      String   @default("kaist.mesc@gmail.com")
  phone      String?
  hoursJson  String?  // OperatingHours JSON (3.1 참조)
  updatedAt  DateTime @updatedAt
}

// 리스트 — 외부링크·SNS (PopupLink 패턴 + category)
model SiteLink {
  id            Int      @id @default(autoincrement())
  category      String   // "important" | "community"
  label         String
  labelEn       String?
  url           String
  description   String?
  descriptionEn String?
  icon          String?  // emoji
  order         Int      @default(0)
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
}

// 리스트 — 동아리 (Member 패턴)
model Club {
  id           Int      @id @default(autoincrement())
  name         String
  nameEn       String?
  tagKo        String?
  tagEn        String?
  descKo       String
  descEn       String?
  activitiesKo String?  // 줄바꿈(\n) 구분 텍스트로 저장 → 표시 시 split
  activitiesEn String?
  url          String?
  urlLabel     String?  // "site" | "insta"
  emoji        String?
  colorPreset  String?  // "blue"|"orange"|"green"|... → 코드 프리셋 맵으로 클래스 변환
  order        Int      @default(0)
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
}
```

### 3.1 운영시간 JSON 구조

`lib/site-settings.ts`에 타입 + 기본값 + 파서를 정의한다.

```ts
export interface OperatingHours {
  days: Array<{
    day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 월=0 … 일=6
    closed: boolean;
    open: string;  // "HH:MM"
    close: string; // "HH:MM"
  }>;
  lunch: { open: string; close: string } | null; // 전역 점심시간(선택)
}
```

- `parseHours(json): OperatingHours` — 실패 시 기본값 반환(pathfinding의 parseGraph 패턴과 동일하게 방어적 파싱).
- 기본값: 월~금 09:00–18:00, 토·일 closed, lunch 12:00–13:00.

### 3.2 동아리 색상 프리셋

```ts
export const CLUB_COLOR_PRESETS: Record<string, string> = {
  blue:   "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
  orange: "from-orange-500/10 to-red-500/10 border-orange-500/20",
  green:  "from-green-500/10 to-emerald-500/10 border-green-500/20",
  purple: "from-purple-500/10 to-pink-500/10 border-purple-500/20",
  // 필요 시 추가
};
```
관리자는 키(blue/orange/…)만 선택, 표시 컴포넌트가 클래스로 변환. 알 수 없는 키/누락 시 기본 프리셋 사용.

## 4. API 라우트

기존 `/api/popup` 라우트 구조를 그대로 따른다(GET 공개 읽기 / 쓰기 메서드는 `auth()` 체크).

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/site-settings` | GET | 싱글톤 조회(없으면 기본값 upsert/반환) |
| `/api/site-settings` | PUT | 운영시간·연락처 수정 (인증) |
| `/api/site-links` | GET | 링크 목록(category 필터 옵션) |
| `/api/site-links` | POST | 링크 생성 (인증) |
| `/api/site-links/[id]` | PUT / DELETE | 링크 수정·삭제 (인증) |
| `/api/clubs` | GET | 동아리 목록 |
| `/api/clubs` | POST | 동아리 생성 (인증) |
| `/api/clubs/[id]` | PUT / DELETE | 동아리 수정·삭제 (인증) |

**검증** (`lib/validation.ts` 재사용 + 필요 시 확장):
- URL 형식, 문자열 길이 상한
- 운영시간: `HH:MM` 정규식, open < close (closed=true면 시간 검증 생략)
- email 형식
- category ∈ {important, community}

## 5. 관리자 UI

- `app/admin/(protected)/page.tsx`의 `links` 배열에 카드 1개 추가:
  - `{ href: "/admin/site", label: "사이트 설정", icon: Settings, desc: "운영시간·연락처·링크·동아리 관리", color: <gray 계열> }`
- 신규 페이지 `app/admin/(protected)/site/page.tsx`: 인증 가드 후 클라이언트 편집 컴포넌트 렌더.
- 편집 컴포넌트 `components/admin/SiteSettingsEditor.tsx`: shadcn `Tabs`로 **3개 탭**
  1. **운영시간·연락처** — 요일별 시간 입력(open/close + 휴무 체크), 점심시간, 위치(KO/EN), 이메일, 전화. PUT `/api/site-settings`.
  2. **링크** — important/community 서브 그룹. 행별 추가/수정/삭제, order, enabled 토글. `/api/site-links*`.
  3. **동아리** — 카드/행 단위 추가/수정/삭제. activities는 textarea(줄바꿈), colorPreset select, emoji, KO/EN. `/api/clubs*`.
- 디자인은 `DESIGN_SYSTEM.md` 준수, 기존 admin 폼/컴포넌트(Input/Textarea/Select/Button/Card) 재사용.

## 6. 공개 페이지 연결

| 페이지 | 데이터 소스 | 방식 |
|---|---|---|
| 홈 운영시간 (`home-client.tsx`) | SiteSettings | `app/page.tsx`(서버)에서 조회 → prop 전달. 깜빡임 없음. 기존 t() 라벨("평일"/"점심시간")은 유지, 값만 DB에서. |
| Footer 연락처·링크 (`Footer.tsx`, 클라이언트) | SiteSettings + SiteLink | 마운트 시 `/api/site-settings`·`/api/site-links` fetch. `lib/links.ts` 현재값을 **초기 fallback 상수**로 사용해 레이아웃 시프트 방지. |
| 동아리 (`members` 서버 컴포넌트) | Club | 서버에서 조회 후 `members-client.tsx`에 prop 전달. |

`lib/links.ts`의 하드코딩 배열은 시드 완료 후 **fallback 상수로 강등**(삭제하지 않고 기본값 출처로 유지) — Footer 초기 렌더 및 시드 스크립트가 참조.

## 7. 마이그레이션 & 시드

1. `prisma migrate dev --name add_site_settings` → SiteSettings / SiteLink / Club 3개 테이블 생성.
2. **시드 스크립트** `scripts/seed-site-settings.ts` (기존 seed-rooms 패턴 참고):
   - 현재 하드코딩 값(운영시간 기본값, 연락처, 링크 7개, 동아리 2개)을 그대로 DB에 입력(upsert).
   - 멱등(idempotent): 재실행해도 중복 생성 안 되도록 (SiteSettings는 id=1 upsert, 리스트는 비어있을 때만 시드).
3. 시드 후 사이트가 전환 전과 **시각적으로 동일**해야 함 = 성공 기준.

## 8. 성공 기준

- 관리자가 `/admin/site`에서 운영시간/연락처/링크/동아리를 추가·수정·삭제·정렬·노출토글할 수 있다.
- 변경이 홈·Footer·members 공개 페이지에 즉시 반영된다(force-dynamic / 클라 fetch).
- 한/영 토글이 입력된 EN 값에 따라 동작한다.
- 시드 직후 사이트 외관이 기존과 동일하다(회귀 없음).
- 잘못된 입력(빈 URL, 잘못된 시간 형식 등)은 API 검증에서 차단된다.
- `npx tsc --noEmit` 및 빌드 통과.

## 9. 단위 경계 (isolation)

- `lib/site-settings.ts` — 타입/기본값/파서/색상 프리셋. 순수 함수, DB·React 비의존. 단독 테스트 가능.
- API 라우트 — DB 접근 + 검증. 각 라우트 단일 책임.
- `SiteSettingsEditor.tsx` — UI만. API와 fetch 인터페이스로만 통신.
- 공개 페이지 — 읽기 전용 소비자. 데이터 출처가 lib 상수 → DB로 바뀌어도 표시 로직 불변.

# 전공서적 서재 + 영문 병기 — 설계 문서

**작성일**: 2026-07-03
**대상**: KAIST 기계공학과 학생회 웹사이트 (Next.js 16 App Router)

---

## 1. 목적

두 가지 개선을 한 번에 진행한다.

1. **전공서적 서재**: 학생회가 보유한 전공서적을 교보문고 서재처럼 **표지 그리드**로 전시해 "전공서적이 비치되어 있다"는 사실 인지도와 이용률을 높인다. (전시 카탈로그만 — 대여 신청/반납 워크플로는 범위 밖)
2. **영문 병기**: 과목명·설명 등 DB에 저장된 내용과 신규 페이지 UI를 영어로도 볼 수 있게 한다. 언어 전환은 기존 `LanguageProvider`(localStorage `lang` = `ko`/`en`)를 그대로 사용한다.

---

## 2. 현재 상태 (관련 코드)

- `prisma/schema.prisma`: `Course { id, code, name, level, description?, textbook?, textbookAvailable, youtubeUrl?, order }`. 텍스트북은 문자열 1개뿐, 표지/저자 없음.
- `app/courses/page.tsx`: 과목 목록. UI 텍스트가 `i18n` 키가 아니라 인라인 `ko/en` 삼항으로 처리됨.
- `lib/i18n.ts`: `navbar/common/footer/home/features/budget/notices/resources/calendar/checkFee/members` 키 존재. **`courses`·`library` 키 없음.**
- `lib/language-context.tsx`: `useLanguage()` → `{ lang, setLang, t }`. `t()`는 키 누락 시 한글 fallback.
- `app/api/upload/route.ts`: Vercel Blob 업로드 (이미지, 5MB, JPG/PNG/WebP/GIF). 재사용.
- 관리자 CRUD 패턴: `app/admin/(protected)/courses/page.tsx` + `app/api/courses/`.

---

## 3. 기능 A — 전공서적 서재

### 3.1 데이터 모델 (신규 `Book`)

```prisma
model Book {
  id         Int      @id @default(autoincrement())
  title      String              // 한글 제목 (필수)
  titleEn    String?             // 영문 제목 (선택)
  author     String?             // 저자 (원문 그대로 — 로마자/한글)
  publisher  String?             // 출판사 (선택)
  coverImage String?             // Blob URL (관리자 업로드, 없으면 플레이스홀더)
  isbn       String?             // 표시/식별용 (선택)
  quantity   Int      @default(1)    // 보유 권수
  available  Boolean  @default(true) // "빌림 가능" 배지 표시 여부
  category   String?             // 분류(예: 열유체/고체/설계/제어/기타) — 필터용
  courseId   Int?                // 연결 과목 (선택)
  course     Course?  @relation(fields: [courseId], references: [id], onDelete: SetNull)
  order      Int      @default(0)
  createdAt  DateTime @default(now())
}
```

`Course` 모델에 역관계 추가: `books Book[]`.

> **저자 영문 필드는 두지 않는다** — 전공서적 저자명은 대개 이미 로마자라 별도 번역 불필요.

### 3.2 API — `/api/books`

기존 `/api/courses` 라우트 패턴을 따른다.

- `GET /api/books` — 공개. 전체 목록 반환. `order`, `createdAt` 정렬. 연결 과목 정보(`code`, `name`) 포함.
- `POST /api/books` — 관리자(`auth()` 세션 필수). 입력 검증은 `lib/validation.ts`(`isValidString`, `parseId`, `isValidUrl`) 사용.
- `PUT /api/books/[id]` — 관리자. 수정.
- `DELETE /api/books/[id]` — 관리자. 삭제.

표지 이미지는 프런트에서 기존 `/api/upload`로 먼저 업로드 → 반환 URL을 `coverImage`로 저장.

### 3.3 관리자 페이지 — `/admin/(protected)/books`

- 기존 관리자 페이지 스타일(예: courses) 준수.
- 목록: 표지 썸네일 + 제목 + 저자 + 보유권수 + 연결과목 + 수정/삭제.
- 추가/수정 폼 필드: 제목, 영문 제목, 저자, 출판사, ISBN, 보유 권수, 분류, 연결 과목(드롭다운 — `/api/courses` 조회), 빌림 가능 토글, 표지 업로드(기존 업로드 컴포넌트 재사용).

### 3.4 공개 페이지 — `/library`

- Nav 항목 추가: **전공서적 / Textbooks**.
- 헤더 섹션(제목/설명) — 다른 페이지와 동일한 hero 패턴.
- **표지 그리드**: 반응형 `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`.
- 책 카드:
  - 표지 이미지 (있으면) — `aspect-[3/4]`, `object-cover`, 미세 아웃라인(`ring-1 ring-black/10 dark:ring-white/10`), `rounded-lg`.
  - 표지 없으면 **텍스트 플레이스홀더**: 책등 느낌의 그라디언트 배경 + 제목 텍스트 (스크린샷의 텍스트-only 표지처럼).
  - 하단: 제목(ko/en `pick`), 저자(작게), `보유 N권` 배지, 연결 과목 배지(있을 때).
  - `hover-lift-premium` 적용.
  - 연결 과목이 있으면 카드 클릭 → `/courses/[code]` 이동. 없으면 비링크.
- 상단 **분류 탭 필터**(전체 + 존재하는 `category` 값들) — courses 페이지의 레벨 탭과 동일 UX.
- 로딩 스켈레톤 / 빈 상태 처리.

---

## 4. 기능 B — 영문 병기

### 4.1 DB 이중 필드

- `Course`: `nameEn String?`, `descriptionEn String?` 추가.
- `Book`: `titleEn String?` (3.1에 포함).
- 관리자 폼에 해당 영문 입력칸 추가.

### 4.2 표시 로직

신규 `lib/bilingual.ts`에 헬퍼 추가:

```ts
export function pick(lang: "ko" | "en", ko: string, en?: string | null): string {
  return lang === "en" && en && en.trim() ? en : ko;
}
```

- `courses` 페이지·`courses/[code]` 상세·`library` 페이지에서 `pick(lang, course.name, course.nameEn)` 형태로 사용.
- 영문이 비어 있으면 한글로 자연스럽게 fallback.

### 4.3 UI 라벨 i18n 정리

- `lib/i18n.ts`에 `courses`, `library` 섹션을 `ko`/`en` 양쪽에 추가.
- `app/courses/page.tsx`의 인라인 `language === "ko" ? ... : ...` 삼항을 `t("courses.xxx")` 키 호출로 교체(일관성).
- 신규 `library` 페이지는 처음부터 `t()` 키 사용.

### 4.4 마이그레이션

- `prisma migrate dev`로 로컬 SQLite에 마이그레이션 생성(신규 `Book` 테이블, `Course` 컬럼 추가).
- 배포 시 고쳐진 `prisma/libsql-migrate.mjs`가 Turso에 자동 적용(멱등적, already-exists 스킵).

---

## 5. 컴포넌트 분리 / 경계

- `app/library/page.tsx` (서버) → 목록 fetch 후 `library-client.tsx`(클라이언트, `useLanguage`)에 전달. courses 페이지와 동일 구조.
- `components/book-cover.tsx`: 표지 이미지 or 텍스트 플레이스홀더 렌더 단일 책임 컴포넌트. `{ title, coverImage }` 입력.
- `lib/bilingual.ts`: `pick()` 순수 함수. UI/DB 무관, 독립 테스트 가능.
- `app/api/books/route.ts`, `app/api/books/[id]/route.ts`: 기존 courses API와 동일 인증·검증 경계.

---

## 6. 에러 처리 / 엣지 케이스

- `/api/books` 실패 시 페이지는 빈 상태 메시지 표시(현재 courses 패턴).
- 표지 URL이 깨진 경우: `onError`로 텍스트 플레이스홀더로 폴백.
- `category`가 없는 책: "기타" 탭 또는 필터 미노출.
- 삭제된 과목과 연결된 책: `onDelete: SetNull`로 `courseId`만 해제, 책은 유지.
- 영문 필드 미입력: 한글 fallback (정상 동작).

---

## 7. 테스트

- `lib/bilingual.ts` `pick()` 단위 테스트: en+값 있음 → en, en+빈값 → ko, ko 모드 → ko.
- `/api/books` 인증: 비로그인 POST/PUT/DELETE 거부(401) 확인.
- 빌드(`npm run build`) 통과 + 타입/lint 무오류.
- 수동: 관리자에서 책 추가(표지 업로드 포함) → `/library`에 표지/제목/저자 노출, 언어 전환 시 영문 제목 반영, 표지 없는 책 플레이스홀더 확인.

---

## 8. 범위 밖 (YAGNI)

- 대여 신청·반납·이력 관리, 재고 자동 차감.
- ISBN 기반 표지·메타 자동 fetch(외부 책 API).
- 교수·구성원·학과소개 영문화(원하면 별도 후속 — 동일 `pick` 패턴 재사용 가능).
- 저자명 영문 필드.

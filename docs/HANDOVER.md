# MESC 웹사이트 인수인계

이 문서는 이 저장소를 이어받아 **개발·보수**하게 될 다음 학생회 임원/개발자를 위한 안내입니다. 처음부터 끝까지 읽지 않아도 되도록 큰 그림 → 자주 하는 작업 → 트러블슈팅 순으로 구성했습니다.

---

## 1. 큰 그림

### 기술 스택
| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | **Next.js 16** (App Router + Turbopack), TypeScript, React 19 |
| DB | **Prisma 7** + **Turso libSQL** (production), SQLite (로컬) |
| 인증 | **next-auth v5 beta** — Credentials provider (admin 단일 계정) |
| 스토리지 | **Vercel Blob** (작은 파일/대표사진) + **Google Drive** (행사사진·평면도·학습자료) |
| 호스팅 | **Vercel** — GitHub 푸시 시 자동 배포 |
| 스타일 | TailwindCSS v4 + shadcn/ui + 일부 base-ui/react |

### 핵심 도메인
- `/` 홈, `/notices` 공지, `/budget` 예산, `/check-fee` 과비, `/calendar` 일정
- `/community` — 갤러리 + 간식 위시 + **건의함** + **자유게시판**
- `/department-info` — 건물·평면도 지도 + 교수님 찾기
- `/members` 학생회 소개, `/courses` 수업정보, `/resources` 학습자료
- `/admin/**` — 관리자 페이지 (next-auth 로 보호)

---

## 2. 로컬 개발 환경 설정

```bash
git clone https://github.com/kaist-me-council/MESC_website.git
cd MESC_website
npm install                              # postinstall 이 prisma generate 실행
cp .env.example .env.local              # 또는 직접 작성
# .env.local 에서 ADMIN_USERNAME / ADMIN_PASSWORD / AUTH_SECRET 등 채우기
npx prisma migrate deploy               # 로컬 SQLite 에 모든 마이그레이션 적용
npm run dev                              # http://localhost:3000
```

### 필수 환경변수 (`.env.local`)
- `DATABASE_URL` (비우면 자동 `file:./prisma/dev.db` SQLite 로 fallback)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` — admin 로그인용
- `AUTH_SECRET`, `NEXTAUTH_SECRET` — JWT 서명 키 (둘 다 채우는 게 안전. `openssl rand -hex 32`)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (선택, Drive 만 쓰면 없어도 됨)
- `GOOGLE_DRIVE_API_KEY` — 공개 폴더 일괄 import 기능용 (선택)
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` — Drive 자동 업로드용 (필수에 가까움)
- `ANON_SALT` — 커뮤니티 익명 태그 hash salt (`openssl rand -hex 32`, production 권장)

### 자주 쓰는 명령
```bash
npm run dev          # 개발 서버
npm run build        # production 빌드 (libsql-migrate + next build)
npm run lint         # ESLint
npx prisma studio    # DB GUI
npx prisma migrate dev --name 변경_이름   # 로컬 마이그레이션 생성 (대화형)
```

---

## 3. 배포 흐름

```
git push origin main
   ↓
Vercel 이 자동으로
   ↓
1) npm install (postinstall: prisma generate)
2) npm run build
   = node prisma/libsql-migrate.mjs   ← Turso DB 마이그레이션
     && next build                     ← Next.js 빌드
   ↓
Production 배포 (mesc-website.vercel.app)
```

### Production DB 마이그레이션의 특수성
Prisma의 공식 `prisma migrate deploy` 는 **`libsql://` 스킴을 인식하지 못해 빌드가 깨집니다** (P1013). 그래서 빌드 직전 우리가 만든 **`prisma/libsql-migrate.mjs`** 가 직접 `@libsql/client` 로 SQL 을 적용합니다.

- 멱등성: 이미 적용된 statement(중복 컬럼/테이블)는 자동 skip.
- `_libsql_migrations` 테이블에 적용 이력 저장.
- 첫 실행 시 마지막 마이그레이션 외 나머지는 "기존에 이미 적용된 것"으로 마킹.

**새 마이그레이션 추가 흐름**:
1. `prisma/schema.prisma` 수정
2. 로컬: `npx prisma migrate dev --name 변경명` → `prisma/migrations/YYYYMMDDHHMMSS_변경명/migration.sql` 자동 생성
3. (libsql 호환을 위해 생성된 SQL 확인 — `CREATE TABLE` 옆에 외래키 표기 등 SQLite 문법인지 확인)
4. `git push` → Vercel 빌드가 자동으로 production DB 에 적용

---

## 4. 데이터 모델 개요 (`prisma/schema.prisma`)

| 모델 | 역할 |
|---|---|
| `Notice` | 공지사항 (카테고리, 상단 고정) |
| `Resource` | 학습자료 (외부 URL or Drive) |
| `BudgetItem` | 예산 내역 (수입/지출) |
| `Member`, `Professor` | 학생회 멤버, 교수님 |
| `Course` | 수업 정보 |
| `Event` + `EventPhoto` + `EventFeedback` | 행사 (Drive 폴더 연동) |
| `SnackWish` | 간식 위시리스트 (익명) |
| `PopupSettings` + `PopupLink` | 홈화면 팝업 |
| `Building` + `BuildingFloor` + `Room` | 건물·층·호실 (지도 시스템) |
| `Suggestion`, `Post`, `Comment`, `Report` | 커뮤니티 |
| `DriveAuth` | Drive OAuth refresh token (단일 행) |

### 자주 헷갈리는 관계
- `Professor` 는 `building`/`floor`/`room` 셋 다 관계가 있음. **`roomId` 가 가장 최신**이고 builder/floor 는 자동 동기화됨 (POST/PUT 라우트 안에 로직).
- `EventPhoto.source` 는 `"blob"` 또는 `"drive"`. `driveFileId` 가 있으면 Drive.
- `Room.code` 는 `"3301"` 같은 호실번호. `wing` = 둘째자리 숫자 (1~5), 지하실은 null.

---

## 5. 인증 (admin)

- 단일 계정 (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) 으로 로그인.
- 세션은 JWT, 쿠키 기반.
- 모든 admin API 라우트는 시작에 `const session = await auth(); if (!session) return 401` 패턴.
- 공개 GET 은 인증 없이 허용 (의도된 것).
- `/admin/*` 경로는 `app/admin/(protected)/layout.tsx` 가 server-side 가드.

### 새로 admin 페이지 추가하기
1. `app/admin/(protected)/<이름>/page.tsx` 생성 (`"use client"` 컴포넌트)
2. `<AdminGuide id="<이름>" title="...">...</AdminGuide>` 로 사용법 안내 추가
3. `app/admin/(protected)/page.tsx` 의 `links` 배열에 카드 추가

---

## 6. Google Drive 통합

### 두 가지 인증 방식 (둘 다 사용)
1. **API 키 (`GOOGLE_DRIVE_API_KEY`)** — 공개 폴더에서만 읽기 가능. 기존 공개 폴더 일괄 import 기능에만 사용.
2. **OAuth (`GOOGLE_OAUTH_CLIENT_ID/SECRET`)** — 사용자(`kaist.mesc@gmail.com`) 본인 권한으로 폴더·파일을 생성·업로드. 한 번만 인증하면 refresh token 으로 영구 사용.

### Drive 폴더 구조 (운영 권장)
```
내 드라이브
└─ 학생회 사이트 DB       ← DriveAuth.parentFolderId 가 가리키는 부모
   ├─ 갤러리              ← 행사 폴더 자동 생성됨 (YYYY-MM-DD-행사명)
   ├─ 평면도              ← 건물 코드 하위폴더 자동 생성
   │   └─ N7
   │       └─ N7-3F-20260527.pdf
   └─ 학습자료            ← 과목코드 하위폴더 자동 생성
       └─ ME200
           └─ [ME200] 원본명.pdf
```

### 파일명 자동 변환 (`lib/filename.ts`)
- `resourceFilename(course, name)` → `[ME200] 원본.pdf`
- `floorplanFilename(building, level, name)` → `N7-3F-20260527.pdf`
- `eventPhotoFilename(date, title, idx, name)` → `2026-05-10-신입생 환영회 (001).jpg`

### Drive 이미지 표시 URL
- 이미지(JPG/PNG): `https://lh3.googleusercontent.com/d/{fileId}=w{width}` (썸네일 CDN)
- PDF: `https://drive.google.com/thumbnail?id={fileId}&sz=w2000` (자동 PNG 렌더)
- 폴더가 "링크가 있는 모든 사용자가 보기"로 공유되어야 동작. OAuth 로 업로드한 파일은 자동으로 `makePublic`.

### Drive OAuth 끊기면 (refresh token 만료)
- `/admin/events` → Drive 자동 연동 카드 → **재인증** 클릭.
- 보통 6개월 미사용 또는 비밀번호 변경 시 만료.

---

## 7. 커뮤니티 (대나무숲 + 건의함)

### 익명성
- 인증 없음. IP 해시 + post_id 로 `익명#a3f9` 태그 생성 (`lib/anon.ts`).
- 같은 IP 가 같은 글 안에 댓글 달면 동일 태그 (흐름 추적용).
- 다른 글에서는 다른 태그 (IP 직접 노출 방지).
- `ANON_SALT` 환경변수가 hash salt. production 에 꼭 설정.

### 도배·악용 방지 단계
1. **rate-limit** (`middleware.ts` + 라우트별) — IP 기준 메모리 카운터.
2. **콘텐츠 필터** (`lib/content-filter.ts`) — 욕설/혐오/학번 8자리/전화/이메일 차단.
3. **신고 시스템** — 5건 누적 시 자동 `hidden=true`.
4. **관리자 모더레이션** (`/admin/community`) — 신고 우선 정렬, 강제 hidden/삭제.

### 금칙어 / 필터 보강
`lib/content-filter.ts` 의 `BLOCKED_KEYWORDS` 배열에 추가하면 즉시 반영. 신상정보 정규식도 같은 파일.

### Rate-limit 조정
- 라우트별 (예: `/api/posts/route.ts` 의 `enforce(ip, "posts", 3, 60_000)` = 1분에 3건)
- 전역 middleware (`middleware.ts`) — 글쓰기 strict 30/분, 일반 60/분
- **Vercel multi-instance 환경**에서는 인스턴스마다 별도 카운터 → 실제 한도 = 설정값 × 인스턴스 수. 정밀한 보호가 필요하면 Vercel KV/Upstash 로 교체 권장.

---

## 8. 지도 시스템

### 흐름
1. 도면 PDF 7장을 admin/buildings 의 "평면도를 Drive 에 업로드" 로 업로드
2. PDF 는 Drive thumbnail 엔드포인트로 자동 PNG 렌더되어 `imageUrl` 에 저장
3. 호실 데이터는 `lib/room-seed-data.ts` 의 시드 데이터로 등록 (`/api/admin/seed-rooms` 한 번 호출)
4. 교수님 등록 시 `roomNumber` 입력 → 같은 층의 Room 자동 매칭 → `roomId` 채워짐
5. 공개 페이지 `/department-info` 에서 평면도 + wing 별 호실 + 호실의 교수님 표시

### 컴포넌트
- `components/floorplan/floorplan-viewer.tsx` — 줌·팬 + 핀(교수 위치) + 팝오버
- `components/floorplan/floorplan-editor.tsx` — admin 핀 배치 (배치 모드 시 줌·팬 우회)
- `react-zoom-pan-pinch` 라이브러리 사용

### 핀 좌표 시스템
`Professor.posX/posY` 는 **0~1 정규화** (평면도 폭/높이 기준 비율). 핀 클릭 시 `(clientX-rect.left)/rect.width` 로 저장. 이미지 사이즈 바뀌어도 비율 유지.

---

## 9. 공통 라이브러리

| 파일 | 역할 |
|---|---|
| `lib/prisma.ts` | Prisma client (libsql adapter) |
| `lib/auth.ts` | next-auth 설정 |
| `lib/validation.ts` | `parseId`, `isValidString`, `isValidUrl` 등 입력 검증 |
| `lib/rate-limit.ts` | IP+버킷 메모리 카운터, `enforce(ip, bucket, max, windowMs)` |
| `lib/content-filter.ts` | 금칙어 + 신상정보 정규식 + HTML sanitize |
| `lib/anon.ts` | 익명 태그·IP 해시 (SHA-256) |
| `lib/filename.ts` | Drive 업로드 파일명 규칙 |
| `lib/drive.ts` | 공개 폴더용 Drive API (`driveImageUrl`) |
| `lib/drive-oauth.ts` | OAuth 흐름 + 폴더·파일 작업 (`ensureSubfolder`, `uploadFile`, `makePublic`) |
| `lib/room-seed-data.ts` | 호실 시드 데이터 (도면 7장에서 추출) |

---

## 10. 자주 하는 작업 레시피

### a) 새 공지 카테고리 추가
1. `lib/validation.ts` 의 `isAllowedCategory` 로 검증되는 라우트 찾기 (`app/api/notices/route.ts` 등)
2. 허용 카테고리 배열에 추가
3. admin/notices 페이지 select 옵션에도 추가

### b) 새 관리자 페이지 추가
위 5번 참조.

### c) 새 마이그레이션 추가
1. `prisma/schema.prisma` 수정
2. `npx prisma migrate dev --name 이름`
3. 빌드 통과 확인 → `git push`

### d) Drive 의 부모 폴더 변경
`/admin/events` → Drive 자동 연동 카드 펼침 → 새 폴더 URL 붙여넣기 → 저장.

### e) Production 호실 데이터 재시드
관리자 로그인 상태로 브라우저 콘솔에서:
```js
await fetch("/api/admin/seed-rooms", { method: "POST" }).then(r => r.json())
```
멱등하므로 여러 번 호출해도 안전.

### f) 새 외부 건물 추가
- `lib/room-seed-data.ts` 의 `EXTERNAL_BUILDINGS` 에 항목 추가 → 시드 라우트 재호출.
- 또는 `/admin/buildings` 에서 직접 추가.

---

## 11. 운영 정기 점검 체크리스트

### 매월
- [ ] **Vercel Blob 사용량** 확인 (대시보드 → Storage). 무료 한도 초과 시 → 오래된 행사 사진/대표사진을 Drive 로 이전.
- [ ] **Vercel Functions 호출량** 확인. 무료 한도 (월 100k invocations) 가까우면 정적 캐싱 활용 고려.
- [ ] **Turso DB 용량** (대시보드). 무료 9GB.
- [ ] 커뮤니티 신고함 (`/admin/community`) 확인.

### 매학기
- [ ] **신입 운영진 교체** 시 `ADMIN_PASSWORD` 변경 (Vercel env → Redeploy)
- [ ] `AUTH_SECRET` 회전 (기존 세션 모두 무효화됨 → 의도된 동작)
- [ ] 간식 위시리스트 초기화 (`/admin/snack-wishes` 의 "전체 삭제")

### 보안 점검
- [ ] `npm audit` 정기 확인
- [ ] Google Cloud → OAuth 동의 화면 "테스트 사용자" 에 운영자 이메일 추가/제거
- [ ] Drive 폴더 공유 권한 확인 (의도치 않게 비공개되면 사이트 이미지 깨짐)

---

## 12. 트러블슈팅

### 사이트가 500 에러
1. Vercel 대시보드 → 최신 deployment → **Functions Logs** 확인
2. 가장 흔한 원인:
   - DB 마이그레이션 누락 (`SQL_INPUT_ERROR: no such column`) → 새 마이그레이션 추가 후 push
   - `GOOGLE_OAUTH_*` 환경변수 누락 (`GOOGLE_OAUTH_CLIENT_ID 또는 SECRET 환경변수가 없습니다`) → Vercel env 에 추가 + **Redeploy** (자동 적용 안 됨)
   - Drive OAuth 만료 → admin/events 에서 재인증

### 빌드 실패 (`P1013: invalid scheme`)
- `prisma migrate deploy` 가 `libsql://` 모르는 케이스. 우리는 `prisma/libsql-migrate.mjs` 로 대체했음. `package.json` 의 `build` 가 이 스크립트를 호출하는지 확인.

### Drive 이미지가 깨짐
- 해당 파일이 `makePublic` 되지 않음 → 우리 코드가 자동 호출하지만 일부 실패할 수 있음
- 사용자가 Drive 에서 직접 공유 권한을 변경했을 수도
- 행사 폴더에 우클릭 → 공유 → "링크가 있는 모든 사용자가 보기" 재확인

### 호실 자동완성이 안 보임
- admin/professors 폼에서 **건물·층을 먼저 선택**해야 그 층의 Room 만 datalist 에 노출

---

## 13. 알려진 한계 + TODO

### 한계
- **Rate-limit 메모리 기반** — Vercel multi-instance 환경에서 부정확. 정밀 보호 필요 시 Vercel KV/Upstash 도입.
- **PDF→이미지 변환을 Node 에서 직접 못 함** — Drive thumbnail 에 의존. 도면이 매우 복잡하면 thumbnail 화질 부족 가능 (현재 1600~2000px).
- **next-auth v5 beta** — production 이지만 API 가 정식 v5 출시 시 깨질 가능성 있음. 출시되면 마이그레이션.
- **OAuth refresh token 만료** — 6개월 미사용 시 끊김. 정기 사용으로 유지 또는 자동 갱신 hook 추가 필요.

### 권장 TODO (시간 날 때)
- [ ] **N7-1, N7-2 임시 건물 삭제** (현재 DB 에 남아 있음, wing 시스템과 중복)
- [ ] **각 층 평면도 PDF 7장 모두 업로드** (현재 1F, 2F 만)
- [ ] **react-pdf 검토** — PDF 자체를 클라이언트에서 렌더 (Drive thumbnail 의존성 제거 + 검색 가능)
- [ ] **건의함 답변 알림** — 답변 작성 시 contactInfo 로 이메일 발송 (Resend 등 SDK)
- [ ] **검색 기능** — 공지/학습자료/교수 통합 검색 (전체 호실 검색은 이미 가능)
- [ ] **다국어 지원 확장** — 현재 ko/en 일부만, 모든 페이지 i18n 보강 (`lib/i18n.ts`, `language-context.tsx`)
- [ ] **Captcha** — 커뮤니티 작성 폼에 Cloudflare Turnstile 추가 (현재 rate-limit 만)
- [ ] **공개 페이지 캐싱** — `revalidate` 설정 늘려 Functions 호출 절약
- [ ] **Image optimization** — Vercel Image Optimization 의 변환 비용 모니터링

---

## 14. 참고 링크

- 배포: https://mesc-website.vercel.app
- GitHub: https://github.com/kaist-me-council/MESC_website
- Vercel: https://vercel.com/kaist-mesc-s-projects/mesc-website
- Google Cloud Console (OAuth/API key): https://console.cloud.google.com (`mesc-website` 프로젝트)
- Turso DB: https://app.turso.tech

설정 변경이나 새 외부 서비스 연동이 필요하면 위 콘솔들 사용. 학생회 메일(`kaist.mesc@gmail.com`)로 모든 외부 계정 통일되어 있습니다.

---

## 15. 자주 도움을 받을 수 있는 곳

- **Next.js App Router**: https://nextjs.org/docs/app
- **Prisma**: https://www.prisma.io/docs
- **next-auth v5**: https://authjs.dev
- **shadcn/ui 컴포넌트**: https://ui.shadcn.com
- **Drive API**: https://developers.google.com/drive/api/v3/reference

문제 생기면 commit history 가 가장 좋은 참고서입니다. 각 commit message 가 "왜" 그렇게 했는지 설명되어 있어요. 막히면 commit 메시지로 검색해보세요.

행운을 빕니다 🚀

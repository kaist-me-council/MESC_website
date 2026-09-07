# 사이트 전반 보강 — 설계·계약

작성 2026-09-08 · 근거 `docs/reviews/2026-09-08-site-wide-enhancement-plan.md` · 브랜치 `feat/tshirt-check`

## 0. 계획서 검토 결과 (채택·수정·보류)

### 채택
| 항목 | 확인한 현재 상태 |
|---|---|
| 과비 확인 GET→POST | `route.ts:86` 이 `searchParams.get("id")` — 학번이 URL·서버 로그·브라우저 기록에 남음. 실재 |
| 공개 화면 무한 로딩 | `app/notices/page.tsx`·`app/notices/[id]/page.tsx` 에 `.catch` 없음. 네트워크 실패 시 "불러오는 중..." 고정. 실재 |
| 관리자 로그인 rate limit | `lib/auth.ts` 에 제한 없음. 무차별 대입 가능. 실재 |
| 최소 감사 로그 | 다중 관리자 계정(mestaff) 운영 중이라 "누가 했는지"가 없음 |
| 조회수·좋아요 | `viewCount`·`likeCount` 없음 |
| 관리자 오늘 할 일 | 기존 데이터로 계산 가능 |
| 사이트맵 | `/apply`·`/privacy`·`/terms`·`/library` 누락, 캠페인 동적 경로 없음 |
| Footer 중복 호출 | 모든 페이지에서 `/api/site-settings`·`/api/site-links` 를 클라이언트에서 매번 호출 |

### 수정 — 계획서가 틀린 부분
**조회수 중복 제거를 "콘텐츠별 서명 쿠키"로 하자는 제안은 채택하지 않는다.**
- 글마다 쿠키를 발급하면 도메인당 쿠키 수·요청 헤더 크기 한계에 걸린다. 공지 50개를 읽은 학생은 쿠키 50개를 매 요청에 실어 보낸다.
- 같은 문서가 "별도 방문자 테이블은 만들지 않는다"고 못박아, 서버가 중복을 검증할 방법이 사라진다. 클라이언트가 보내는 쿠키 유무만 믿게 되어 위조에 무방비다.
- **대안(채택)**: 방문자 토큰 쿠키 **1개**(httpOnly, 1년, 랜덤) + 작은 `ContentView(kind, contentId, viewerHash)` 유니크 테이블로 서버측 중복 제거. 규모: 공지 50개 × 학생 500명 ≈ 2.5만 행/년. 주간 크론에서 90일 지난 행 삭제. Turso 무료 한도 대비 무시할 수준.

### 보류 — 판단이 필요해 그대로 두는 부분
- **과비 "납부 여부만" 노출**: 보안 이득이 실질적으로 없다. 학번을 아는 사람이 여부를 알 수 있다면 횟수도 같은 수준의 노출이며, 횟수는 학생회가 실제로 쓰는 정보다. 현행(횟수 표시) 유지하고 회장 판단으로 남긴다.
- **`robots.txt` 신설**: 이미 `public/robots.txt` 에 `/admin`·`/api/` 차단과 사이트맵 선언이 있다. 할 일 없음.
- **감사 로그를 공지 게시 상태까지 확대**: 범위를 캠페인 주문 상태·적재 교체·삭제 계열로 한정한다. 넓히면 로그만 쌓이고 아무도 안 본다.
- **"최근 조회 시각" 컬럼**: 총 조회수로 충분. 컬럼 추가하지 않는다.
- **파일 제출(6단계)**: 제외. 실제 요구가 생기면 별도 설계.

## 1. 스키마 (완료 — `20260908000003_views_likes_audit`)

`Notice.viewCount`, `Event.viewCount`, `Post.viewCount`, `Post.likeCount` 추가.
```prisma
model AdminAudit  { id, actor, action, target, detail?, createdAt, @@index([createdAt]) }
model ContentView { id, kind, contentId, viewerHash, createdAt, @@unique([kind, contentId, viewerHash]), @@index([createdAt]) }
model PostLike    { id, postId(FK cascade), voterHash, createdAt, @@unique([postId, voterHash]) }
```

## 2. 공용 모듈 계약

### `lib/visitor.ts` (신규, 서버 전용)
- `getOrCreateVisitorToken()`: `next/headers` 의 `cookies()` 로 `mesc_vid` 를 읽고 없으면 32자 랜덤 생성. httpOnly, sameSite lax, secure(프로덕션), maxAge 1년, path `/`.
- `visitorHash(token, scope)`: `sha256(ANON_SALT:vid:scope:token)` 앞 24자. `lib/anon.ts` 의 `getAnonSalt()` 재사용.
- 라우트 핸들러에서 쿠키를 세팅할 수 있도록, 토큰이 새로 만들어졌으면 응답에 `Set-Cookie` 를 붙이는 헬퍼도 함께 제공한다.

### `lib/audit.ts` (신규, 서버 전용)
- `audit(actor, action, target, detail?)`: `prisma.adminAudit.create`. **실패해도 절대 throw 하지 않는다**(감사 로그 때문에 본 작업이 실패하면 안 됨). 개인정보 원문·CSV 본문 금지, 건수·상태 요약만.

## 3. 1단계 — 안정성·개인정보 (에이전트 A)

### 3-1. 과비 확인 POST 전환
- `app/api/check-fee/route.ts`: `POST` 추가(본문 `{ id }`), 기존 `GET` 은 **410 Gone + 안내 메시지**로 바꿔 캐시된 클라이언트가 조용히 깨지지 않게 한다. 레이트리밋·전역 상한은 그대로 유지하고 POST 에도 적용.
- `app/check-fee/page.tsx`: POST 로 호출. 네트워크 실패·429·5xx 를 구분해 표시하고, 실패해도 버튼 잠금 해제·입력 보존.
- 납부 횟수 표시는 그대로 둔다(0절 보류 항목).

### 3-2. 관리자 로그인 rate limit
- `lib/auth.ts` `authorize` 진입 시 `enforce(ip, "login:"+username, 5, 10분)` 과 IP 단위 `enforce(ip, "login-ip", 20, 10분)` 을 적용. 초과하면 `null` 반환(계정 존재 여부 노출 금지).
- 실패 시 200~400ms 지연을 준다. 성공하면 해당 버킷을 초기화하는 `reset(ip, bucket)` 을 `lib/rate-limit.ts` 에 추가.
- `authorize` 에서 IP 를 얻으려면 `next/headers` 의 `headers()` 로 `x-forwarded-for` 를 읽는다.

### 3-3. 감사 로그 연결
- 캠페인 주문 상태 변경(단건·일괄), 주문 항목 수정, 적재(replace 여부·건수), 캠페인 삭제, 공지 삭제에 `audit()` 호출.
- 관리자 화면 `/admin/audit` 은 이번에 만들지 않는다. 대신 캠페인 상세에 최근 20건을 보여 주는 것도 하지 않는다. **DB 에 남기는 것까지가 이번 범위**(조회는 필요해지면 추가).

## 4. 2·3단계 — 조회수·좋아요 (에이전트 B)

### 4-1. 조회수
- `POST /api/views` — 본문 `{ kind: "notice"|"event"|"post", id }`. 절차:
  1. 방문자 토큰 확보(없으면 발급, 응답에 Set-Cookie).
  2. 관리자 세션이면 무시하고 `{ counted: false }`.
  3. user-agent 가 명백한 봇(`bot|crawler|spider|slurp|bingpreview`)이면 무시.
  4. 대상이 존재하고 공개 상태인지 확인. 아니면 **성공 응답과 동일한 형태로 `{ counted: false }`** 반환(존재 여부 비노출).
  5. `ContentView` 유니크 위반이면 `{ counted: false }`, 새로 만들어졌으면 같은 트랜잭션에서 `viewCount: { increment: 1 }`.
  6. 24시간 규칙: `ContentView` 행의 `createdAt` 이 24시간보다 오래됐으면 갱신하고 다시 센다.
- 레이트리밋 `enforce(ip, "views", 60, 60_000)`.
- 실패는 절대 페이지를 막지 않는다(클라이언트에서 fire-and-forget, 에러 무시).
- 표시: 공지 상세·행사 상세·게시글 상세에만 "조회 n". 목록에는 표시하지 않는다.

### 4-2. 좋아요
- `POST /api/posts/[id]/like` — 토글. 방문자 토큰 해시로 `PostLike` 를 만들거나 지우고, 같은 트랜잭션에서 `likeCount` 를 ±1.
- 숨김(`hidden`) 게시글은 404. 레이트리밋 `enforce(ip, "like", 30, 60_000)`.
- `GET /api/posts/[id]` 응답에 `likeCount` 와 `liked`(현재 방문자 기준) 포함.
- UI: 게시글 상세에 하트 버튼 + 수. 낙관적 갱신하되 실패하면 되돌리고 오류 표시. 댓글 좋아요·싫어요 없음.

### 4-3. 크론 정리
- `app/api/cron/backup/route.ts` `purgeExpired` 에 `contentView` 90일 초과 삭제, `adminAudit` 180일 초과 삭제 추가.

## 5. 공개 실패 상태·관리자 효율·성능 (에이전트 C)

### 5-1. 공개 화면 4상태 통일
- 대상: `app/notices/page.tsx`, `app/notices/[id]/page.tsx`, `app/community/**`(목록·상세), `app/resources/page.tsx`, `app/courses/**` 중 클라이언트 fetch 를 쓰는 화면.
- `app/apply/[slug]/types.ts` 의 `request()`/`errText()` 와 같은 방식을 **공용 모듈 `lib/fetch-state.ts`** 로 승격해 재사용한다(apply 쪽은 그 모듈을 다시 export 해 쓰도록 최소 수정).
- 각 화면은 `loading / error+재시도 / empty / success` 네 상태. 통신 실패를 "내용 없음"으로 표시하지 않는다. 필터·검색 상태는 재시도 후에도 유지.

### 5-2. 관리자 오늘 할 일
- `/admin` 상단에 카드 3~4개: 입금 대기 건수, 수령 확인 미응답 건수(확인 켜진 캠페인만), 미답변 건의, 미처리 신고. 전부 기존 테이블 집계로 구하고 **서버 컴포넌트에서 직접 prisma 조회**(새 API 만들지 않음).
- 조회 실패 시 0 이 아니라 "-" 와 "불러오지 못했습니다"를 표시한다.
- 각 카드는 해당 관리 화면으로 링크.

### 5-3. 사이트맵·푸터
- 사이트맵에 `/apply`, `/privacy`, `/terms`, `/library`, `/budget`(있으면), 그리고 공개된 캠페인 `/apply/[slug]` 를 추가. DB 실패 시 정적 경로만 반환하는 기존 방어 유지.
- Footer 의 `/api/site-settings`·`/api/site-links` 클라이언트 호출을 제거하고, 서버에서 조회해 props 로 내려준다. `app/layout.tsx` 가 서버 컴포넌트이므로 거기서 조회해 `<Footer settings={...} links={...} />` 로 전달하고, 레이아웃에 `export const revalidate = 300` 을 둘 수 없으면 `unstable_cache` 또는 조회 함수에 짧은 캐시를 적용한다.

### 5-4. 접근성 점검
- 360px 폭 가로 스크롤 없음, 아이콘 전용 버튼에 `aria-label`, 폼 입력에 연결된 label, 탭 역할에 `aria-selected`·키보드 이동, Navbar 드롭다운·모바일 메뉴 ESC 닫기와 초점 복귀.
- 새로 만든 화면(`/apply`, `/admin` 레이아웃) 우선, 나머지는 발견되는 대로.

## 6. 검증
- 타입·린트·프로덕션 빌드.
- e2e 추가(`scripts/site-api.test.sh` 신규): 과비 POST 성공·GET 410, 같은 방문자 24시간 내 재조회 시 1회만 증가, 다른 글 별도 집계, 숨김 글 좋아요 404, 좋아요 토글 2회 후 원상복구, 로그인 6회 실패 시 차단·정상 계정 복구.
- 프로덕션 DB 미사용. 로컬 dev.db + 격리 서버만.

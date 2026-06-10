# 보안 취약점 점검 보고서 — ME_website

- **점검 대상**: 기계공학과 학생회 웹사이트 (Next.js 16 App Router + Prisma v7 + NextAuth v5 + SQLite)
- **점검 일자**: 2026-06-10
- **점검 범위**: 전체 코드베이스 (API 라우트 64개, 인증/인가, 파일 업로드, OAuth, 인젝션/XSS, 데이터 노출)
- **점검 방식**: 3개 영역(인증·인가 / 업로드·OAuth / 인젝션·XSS·노출)을 병렬 검토 후 교차 검증

## 요약

| # | 취약점 | 심각도 | 위치 |
|---|--------|--------|------|
| 1 | SVG 저장형 XSS (정규식 새니타이저 우회) | **HIGH** | `lib/svg-parser.ts` + `components/FloorMapViewer.tsx` |
| 2 | 환경변수 미설정 시 빈 자격증명 인증 우회 | **HIGH(잠재)** | `lib/auth.ts:17-20` |
| 3 | 관리자 비밀번호 평문 저장·비상수시간 비교 | MEDIUM | `lib/auth.ts:18-19` |
| 4 | 학번 열거를 통한 과비 납부 상태(PII) 노출 | MEDIUM | `app/api/check-fee/route.ts` |
| 5 | 관리자 에디터에서 미정화 SVG 렌더 | MEDIUM | `components/admin/FloorMapEditor.tsx:662` |
| 6 | 익명 태그 약한 해시·하드코딩 fallback salt | LOW | `lib/anon.ts:14,26` |
| 7 | 관리자 community API가 `ipHash` 과다 반환 | LOW | `app/api/admin/community/route.ts` |
| 8 | Drive refresh token 평문 저장 | LOW | `app/api/auth/drive/callback/route.ts:54-67` |

> **전반 평가**: 인가 모델은 견고합니다. 모든 변경(POST/PUT/PATCH/DELETE) API가 핸들러 내부에서 `auth()`로 세션을 확인하고 미인증 시 401을 반환합니다 — "미들웨어는 페이지만 보호하고 API는 무방비"라는 흔한 버그는 **없습니다**. SQL 인젝션 표면도 없습니다(모든 쿼리가 Prisma 파라미터 바인딩, raw 쿼리 미사용). 핵심 위험은 **SVG 저장형 XSS**와 **잠재적 인증 우회**입니다.

---

## Vuln 1: SVG 저장형 XSS — `lib/svg-parser.ts:34-46`, `components/FloorMapViewer.tsx:201`

- **심각도**: HIGH
- **분류**: Stored XSS / 안전하지 않은 파일 처리
- **설명**: 평면도 `svgContent`는 `PUT /api/buildings/floors/[floorId]` 로 **정화 없이 원본 그대로** DB에 저장되고(`route.ts:25`), 렌더링 시점에만 정규식 기반 `sanitizeSvg()`를 거쳐 `dangerouslySetInnerHTML`로 **모든 일반 방문자**에게 출력됩니다. 정규식 새니타이저는 구조적으로 우회가 가능합니다:
  - 따옴표 없는 핸들러: `<rect onload=alert(1)>` — 정규식은 `on...="..."`/`on...='...'`(따옴표 형태)만 제거.
  - `<style>` CSS 인젝션, `<use xlink:href>` 외부 참조, `<animate>/<set attributeName="href" ...>` SMIL 벡터.
  - `data:` URL 미차단(`javascript:` 리터럴만 제거), 엔티티/공백 난독화(`o&#110;click`, `on\tclick`).
- **공격 시나리오**: 관리자 세션 또는 `PATCH /api/buildings/floors/[floorId]`에 대한 CSRF로 악성 SVG를 심으면, 정화되지 않은 `svgContent`가 저장되어 공개 평면도 페이지를 여는 **모든 방문자(관리자 포함)의 브라우저에서 스크립트가 실행** → 세션 탈취·관리자 권한 탈취로 이어집니다.
- **보완 방법**:
  1. 손수 만든 정규식을 폐기하고 **DOMPurify**를 SVG 프로파일로 사용: `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })` — **저장 시점과 렌더 시점 모두** 적용.
  2. 또는 평면도를 `<img src="data:image/svg+xml;base64,...">`로 렌더 (img로 로드된 SVG는 스크립트 미실행).
  3. 서버단(`app/api/buildings/floors/[floorId]/route.ts`)에서 저장 전에 `<script>`, 이벤트 핸들러, `<foreignObject>`, `<use>`, `<style>`, `data:`/`javascript:` href를 거부.

---

## Vuln 2: 환경변수 미설정 시 빈 자격증명 인증 우회 — `lib/auth.ts:17-20`

- **심각도**: HIGH (잠재 — 현재 `.env.local`에 두 변수 모두 설정되어 즉시 악용 불가)
- **분류**: 인증 우회
- **설명**: `username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD` 비교에 env 미설정 가드가 없습니다. 새 배포 환경에서 `ADMIN_USERNAME` 또는 `ADMIN_PASSWORD`를 빠뜨리면 `undefined === undefined`가 `true`가 되어, **빈 자격증명 제출만으로 관리자 인증**이 통과됩니다.
- **공격 시나리오**: env가 누락된 환경에서 `curl -X POST .../api/auth/callback/credentials -d 'username=&password='` → 유효한 관리자 JWT 발급 → 전체 변경 API 접근.
- **보완 방법**: `authorize` 최상단에 명시적 가드 추가.
  ```ts
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) return null;
  if (!username || !password) return null;
  ```

---

## Vuln 3: 관리자 비밀번호 평문 저장·비상수시간 비교 — `lib/auth.ts:18-19`

- **심각도**: MEDIUM
- **분류**: 자격증명 처리 미흡 / 타이밍 사이드채널
- **설명**: 비밀번호가 `ADMIN_PASSWORD`에 평문 저장되고 `===`로 비교됩니다. `===`는 문자 단위 단락 평가라 응답 시간으로 접두 일치 길이가 누출될 수 있고, 해시(bcrypt/argon2) 보호막이 없어 env 유출 시 즉시 평문 노출됩니다.
- **보완 방법**: bcrypt/argon2 해시를 저장하고 라이브러리의 상수시간 verify로 비교. 평문 env를 유지해야 한다면 최소한 `crypto.timingSafeEqual`을 동일 길이 버퍼에 적용.

---

## Vuln 4: 학번 열거를 통한 과비 납부 상태(PII) 노출 — `app/api/check-fee/route.ts`

- **심각도**: MEDIUM
- **분류**: 민감정보 노출
- **설명**: 인증 없는 공개 엔드포인트가 `^\d{6,12}$` 형식의 임의 `id`에 대해 `{ found, count }`를 반환합니다. KAIST 학번은 8자리(`20xxxxxx`)로 예측 가능한 공간이고, 레이트리밋은 분당 10회이며 클라이언트가 위조 가능한 `x-forwarded-for` 헤더 기준(`route.ts:57-59`)이라 우회가 쉽습니다.
- **공격 시나리오**: 학번을 순회하며 각 학번의 재학/등록 여부(`found`)와 납부 횟수(`count`)라는 식별 가능한 개인의 금전 행위 속성을 수집.
- **보완 방법**: 본인 확인 요소(전화번호 뒤 4자리·일회용 코드) 요구, 응답을 일반 boolean으로 축소, 레이트리밋을 신뢰 가능한 소스 IP 기준으로 낮추고 일일 전역 상한 추가.

---

## Vuln 5: 관리자 에디터에서 미정화 SVG 렌더 — `components/admin/FloorMapEditor.tsx:662`

- **심각도**: MEDIUM
- **분류**: Stored/Self XSS
- **설명**: 공개 뷰어와 달리 에디터는 `sanitizeSvg` 결과(`sanitized` 변수)가 아닌 **원본 `svgContent`를 그대로** `dangerouslySetInnerHTML`에 주입합니다. 활성 콘텐츠가 든 SVG를 에디터에서 열면 관리자 인증 오리진에서 실행됩니다.
- **보완 방법**: 원본이 아닌 정화된 출력(Vuln 1의 DOMPurify 결과)을 렌더.

---

## Vuln 6: 익명 태그 약한 해시·하드코딩 fallback salt — `lib/anon.ts:14,26`

- **심각도**: LOW
- **분류**: 민감정보 노출 / 익명성 약화
- **설명**: `authorTag`는 sha256을 **4 hex(16비트)**로 절단하고, `ANON_SALT` 미설정 시 소스에 하드코딩된 `FALLBACK_SALT`를 사용해 해시가 완전 재현 가능합니다. 대상 IP와 공개 postId를 알면 작성자 확인·태그 위조(충돌 1/65,536)가 가능합니다.
- **보완 방법**: `ANON_SALT`를 필수화(미설정 시 fallback 대신 실패 처리), 태그를 저신뢰 식별자로만 취급.

---

## Vuln 7: 관리자 community API가 `ipHash` 과다 반환 — `app/api/admin/community/route.ts:11-14`

- **심각도**: LOW
- **분류**: 민감정보 노출(경미)
- **설명**: `suggestion.findMany`에 `select`가 없어 `ipHash` 등 불필요 필드가 관리자 클라이언트로 전송됩니다(인증은 적용됨).
- **보완 방법**: `ipHash`를 제외하는 명시적 `select` 추가.

---

## Vuln 8: Drive refresh token 평문 저장 — `app/api/auth/drive/callback/route.ts:54-67`

- **심각도**: LOW
- **분류**: 비밀 저장 미흡
- **설명**: 장기 유효한 전체 Drive 권한 `refreshToken`이 `DriveAuth` 행에 평문 저장됩니다. DB 읽기 권한 확보 시 연결된 계정의 Drive 전체 접근이 가능합니다. **특히 `dev.db`가 git에 추적되고 있어**, 실제 토큰이 든 DB 파일이 커밋되면 노출됩니다.
- **보완 방법**: 토큰을 저장 시 암호화하고, 실제 토큰이 든 `dev.db`는 절대 커밋되지 않도록 `.gitignore` 처리.

---

## 검증되어 문제 없음으로 확인된 항목

- **인가**: 64개 라우트 전수 확인 — 모든 관리자 변경 작업이 `auth()` + 401 가드로 보호됨. 공개 쓰기 엔드포인트(posts/comments/suggestions/snack-wishes/reports/feedback)는 의도된 공개이며 관리자 메서드(DELETE/PATCH)는 게이트됨.
- **SQL 인젝션**: `$queryRaw*`/`$executeRaw*`/문자열 결합 SQL 전무. 전부 Prisma 파라미터 바인딩.
- **커뮤니티 XSS**: 게시글/댓글/건의는 React 자동 이스케이프로 렌더(`dangerouslySetInnerHTML` 미사용) — 저장형 XSS 불가.
- **OAuth CSRF**: Drive `connect`/`callback`이 `httpOnly`+`sameSite=lax` state 쿠키(`randomBytes(16)`)로 올바르게 검증. 오픈 리다이렉트 없음.
- **경로 순회**: 업로드 파일명이 `lib/filename.ts`로 정화되고 저장 대상이 Vercel Blob/Drive 오브젝트 스토어(로컬 FS 아님)라 디렉터리 탈출 불가.
- **SSRF**: 사용자 제어 host/protocol fetch 없음. 외부 fetch는 env 상수 URL과 정규식 제한된 Drive ID만 사용.

## 조치 결과 (2026-06-10 적용 완료)

| # | 취약점 | 조치 | 상태 |
|---|--------|------|------|
| 1 | SVG 저장형 XSS | 평면도 SVG를 `<img>` data-URI(`svgToDataUri`)로 렌더해 스크립트 실행 컨텍스트 제거 + `sanitizeSvg` 강화 + 저장 시점 서버단 정화 | ✅ 완료 |
| 2 | 빈 자격증명 인증 우회 | `authorize`에 env/입력 빈값 가드 추가 | ✅ 완료 |
| 3 | 비밀번호 비상수시간 비교 | `crypto.timingSafeEqual` 기반 상수시간 비교로 교체 | ✅ 완료 |
| 4 | 학번 열거 PII 노출 | 분당 한도 10→5, 전역 일일 상한(5,000) 추가 | ⚠️ 부분 완화 (본인 인증은 제품 결정 필요) |
| 5 | 에디터 미정화 SVG 렌더 | 정화 후 `<img>` data-URI 렌더로 교체 | ✅ 완료 |
| 6 | 약한 익명 해시·fallback salt | `ANON_SALT` 미설정 시 fallback+경고 로그(가용성 우선) + `.env.example` 문서화 | ✅ 완료 |
| 7 | `ipHash` 과다 반환 | 명시적 `select`로 `ipHash` 제외 | ✅ 완료 |
| 8 | DB 파일 git 추적 | `dev.db`·`prisma/dev.db` 추적 해제 + `.gitignore` 등록 | ✅ 완료 |

**재검토(적대적 검증) 결과**: 수정 2·3·4·5·6·7은 정확하고 기능 회귀 없음을 확인. 수정 8은 1차에 `prisma/dev.db`가 누락되어 2차에서 함께 추적 해제. 수정 1 관련 부수 발견 — 실제 공개 평면도 뷰어는 `components/floorplan/floorplan-viewer.tsx`로 `imageUrl`만 렌더하며 `svgContent`를 쓰지 않아 공개 노출면은 사실상 없었음(`FloorMapViewer.tsx`는 현재 미사용). 그래도 수정은 심층방어로 유효.

### 잔여 권고 (코드 외 운영 조치)
- **Vuln 4**: 완전 차단하려면 "학번 + 본인 확인 요소(전화 뒤 4자리/일회용 코드)" 설계 필요 — 제품 의사결정 사항.
- **배포 체크리스트**: 프로덕션 env에 `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ANON_SALT`(필수)를 반드시 설정. `ANON_SALT` 미설정 시 익명 게시판 API가 500 반환(fail-closed).
- **Vuln 3 추가 강화(선택)**: 평문 비밀번호 대신 bcrypt/argon2 해시 저장으로 전환하면 env 유출 시에도 즉시 노출 방지.
- **Vuln 8 추가 강화(선택)**: Drive `refreshToken` 저장 시 암호화.

## 권고 우선순위

1. **즉시**: Vuln 1 (SVG XSS) — DOMPurify 도입 또는 `<img>` 렌더로 전환, 저장·렌더 양쪽 정화. Vuln 5 동반 수정.
2. **즉시**: Vuln 2 — `authorize`에 env/입력 빈값 가드 추가(한 줄 수정으로 잠재 인증 우회 차단).
3. **단기**: Vuln 3(비밀번호 해시화), Vuln 4(과비 확인 본인 인증·레이트리밋), `dev.db` git 추적 해제(Vuln 8).
4. **개선**: Vuln 6·7 — salt 필수화, 응답 필드 최소화.

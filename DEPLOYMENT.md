# 배포 가이드 (내가 직접 해야 하는 작업)

> 코드 쪽 배포 준비(404·에러 페이지·sitemap·OG 메타)는 끝났습니다.
> 남은 건 **외부 계정 작업 2가지** 뿐입니다: ① Turso DB, ② Vercel 환경변수.

---

## STEP 1. Turso 원격 DB 만들기 (필수)

> 왜? Vercel 서버리스는 파일을 보존하지 못해 현재 SQLite 파일 DB가 작동하지 않습니다.
> 글이 사라지는 걸 막으려면 원격 DB(Turso)가 반드시 필요합니다. (코드는 이미 Turso 지원)

1. https://turso.tech 가입
2. CLI 설치 (한 번만)
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
3. DB 생성
   ```bash
   turso db create mesc-website
   ```
4. **DB URL 확인** (libsql://... 로 시작) → STEP 2의 `DATABASE_URL`에 사용
   ```bash
   turso db show mesc-website --url
   ```
5. **토큰 발급** → STEP 2의 `TURSO_AUTH_TOKEN`에 사용
   ```bash
   turso db tokens create mesc-website
   ```

---

## STEP 2. Vercel 환경변수 등록 (필수)

Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables** 에서 등록.
(Environment는 **Production** 체크)

### 🔴 반드시 (없으면 사이트가 안 돌아감)

| 변수 | 값 만드는 법 |
|---|---|
| `DATABASE_URL` | STEP 1-4의 libsql:// URL |
| `TURSO_AUTH_TOKEN` | STEP 1-5의 토큰 |
| `ADMIN_USERNAME` | 새 관리자 아이디 (로컬에서 쓰던 값 재사용 금지) |
| `ADMIN_PASSWORD` | 새 강한 비밀번호 |
| `AUTH_SECRET` | 터미널에서 `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | 터미널에서 `openssl rand -base64 32` (위와 다른 값) |
| `NEXTAUTH_URL` | 배포 도메인. 예: `https://mesc-website.vercel.app` |
| `ANON_SALT` | 터미널에서 `openssl rand -hex 32` |

### 🟡 기능별 (그 기능을 쓸 때만)

| 변수 | 용도 |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | 사진/파일 업로드 (Vercel → Storage → Blob 에서 발급) |
| `GOOGLE_FEE_CSV_URL` | 과비 납부 확인 |
| `GOOGLE_BUDGET_CSV_URL` | 예산 데이터 |
| `NEXT_PUBLIC_BUDGET_SHEET_EMBED_URL` | 예산 시트 임베드 |
| `NEXT_PUBLIC_ICAL_URL` | 캘린더 구독 |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | 행사사진 Google Drive 동기화 |

> 전체 변수 목록과 설명은 `.env.example` 참고.

---

## STEP 3. 배포 & 첫 데이터 시드

1. Vercel이 GitHub `main` 푸시를 감지해 자동 배포함 (환경변수 등록 후 한 번 **Redeploy**)
2. 빌드 시 DB 마이그레이션은 `libsql-migrate.mjs`가 **자동** 적용
3. 배포 성공 후, 사이트 설정(운영시간·연락처·링크·동아리) 초기 데이터 1회 주입:
   ```bash
   node scripts/seed-site-settings.mjs
   ```
   (DATABASE_URL/TURSO_AUTH_TOKEN이 Turso를 가리키는 환경에서 실행)

---

## STEP 4. 배포 후 확인 체크리스트

- [ ] 홈/공지/예산/캘린더 페이지가 뜨는가
- [ ] `/admin` 로그인이 새 ADMIN 계정으로 되는가
- [ ] 공지 작성 → 새로고침해도 남아있는가 (= DB 영속성 OK)
- [ ] `https://(도메인)/sitemap.xml` 이 열리는가
- [ ] 없는 주소(예: `/asdf`) 접근 시 404 페이지가 뜨는가
- [ ] 과비/예산 Google Sheet **공유 범위 확인**: "링크 있는 사람 보기"인지
      (CSV URL 자체에 학번·이름이 있으면 URL 아는 사람이 원본을 볼 수 있음.
       사이트 API는 인원수만 반환하지만 원본 시트는 별개)

---

## 보안 메모

- 로컬 `.env.local`은 git에 커밋되지 않음 (확인됨). 프로덕션 값은 Vercel 대시보드에만.
- `AUTH_SECRET`/`NEXTAUTH_SECRET`/`ANON_SALT`는 절대 코드/문서에 적지 말 것.

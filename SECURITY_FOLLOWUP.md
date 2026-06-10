# 보안 후속 작업 가이드

> 이 문서는 `SECURITY_REPORT.md`에서 **코드로 즉시 처리한 8건 이후 남은 작업**과 그 수행 방법을 담는다.
> 대상자: 학생회 웹 운영/개발 담당자. 최종 업데이트: 2026-06-10.

---

## 0. ⚠️ 이번 배포 직전 반드시 확인 (Vercel 환경변수)

이번 보안 수정으로 **환경변수에 의존하는 동작이 추가**되었다. 배포 전에 Vercel 대시보드
(Settings → Environment Variables, Production)에서 아래 값이 설정돼 있는지 반드시 확인한다.

| 변수 | 미설정 시 영향 | 필수 |
|------|---------------|------|
| `ADMIN_USERNAME` | 관리자 로그인 **전면 거부** | ✅ |
| `ADMIN_PASSWORD` | 관리자 로그인 **전면 거부** | ✅ |
| `ANON_SALT` | 익명 게시판은 동작하나 **추측 가능한 fallback salt**로 익명성 약화(서버 로그 1회 경고) | 권장 |
| `AUTH_SECRET` 또는 `NEXTAUTH_SECRET` | 세션 서명 불가 → 로그인 불가 | ✅ |

`ANON_SALT` 생성 예시:
```bash
openssl rand -hex 32
```
→ 출력값을 Vercel `ANON_SALT` (Production)에 입력 후 저장.

> `ADMIN_*`/`AUTH_SECRET`은 기존부터 설정돼 있어야 로그인이 동작한다.
> `ANON_SALT`는 미설정이어도 게시판은 동작하지만(가용성 우선), 익명성 보장을 위해
> 가능한 한 빨리 설정하길 권장한다(미설정 시 서버 로그에 경고 1회 출력).

---

## 1. 남은 보안 작업 (우선순위 순)

### P1. 과비 확인 학번 열거 완전 차단 — *제품 의사결정 필요*
- **현 상태**: 레이트리밋(분당 5회 + 일일 5,000회)로 *완화*만 됨. `GET /api/check-fee?id=학번`은
  여전히 학번만 알면 재학/납부 여부를 알려준다.
- **근본 해결안 (택1)**:
  1. **본인 확인 요소 추가**: 학번 + (전화번호 뒤 4자리 | 이름 | 일회용 코드)를 함께 요구해 일치할 때만 응답.
     - `app/api/check-fee/route.ts`에서 시트의 추가 컬럼(전화/이름)을 읽어 비교하도록 수정.
     - 프론트(`/check-fee` 페이지)에 입력 필드 1개 추가.
  2. **결과 일반화**: `count`(납부 횟수) 노출을 없애고 `paid: true/false`만 반환 → 금전 행위 속성 노출 축소.
- **권장**: 1안(본인 확인) + 2안(결과 최소화) 병행. 작업량: 반나절.

### P2. 관리자 비밀번호 해시화 — *선택, 보안 강화*
- **현 상태**: `ADMIN_PASSWORD` 평문 env. 비교는 이미 상수시간으로 교체됨.
- **개선**: bcrypt/argon2 해시를 env에 저장하고 검증.
  ```bash
  npm i bcryptjs
  node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" '실제비밀번호'
  ```
  → 출력 해시를 `ADMIN_PASSWORD_HASH`로 저장하고 `lib/auth.ts`에서
  `bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH)`로 검증.
- 작업량: 1시간. env 유출 시에도 평문 비밀번호가 드러나지 않는다.

### P3. Google Drive refresh token 암호화 저장 — *선택*
- **현 상태**: `DriveAuth.refreshToken`이 평문. DB 읽기 권한 확보 시 연결 계정 Drive 전체 접근 가능.
- **개선**: 저장 전 `crypto`(AES-256-GCM)로 암호화, 키는 `DRIVE_TOKEN_KEY` env에 보관.
  - 수정 위치: `app/api/auth/drive/callback/route.ts`(저장), `lib/drive-oauth.ts`(복호화 후 사용).
- 작업량: 2시간.

### P4. 추가 하드닝 — *여유 시*
- **단일 관리자 → 역할 분리**: 현재 단일 admin 계정. 사용자 수가 늘면 NextAuth에 DB 기반
  User/Role 모델 도입 검토.
- **보안 헤더**: `next.config`에 CSP/`X-Content-Type-Options`/`Referrer-Policy` 추가.
  특히 CSP `default-src 'self'`는 잔여 XSS의 2차 방어선.
- **업로드 매직바이트 검증**: 업로드 엔드포인트가 `file.type`(스푸핑 가능)만 신뢰. `sharp`로
  이미지 실제 디코드 검증을 모든 경로에 적용(현재 일부만).

---

## 2. 정기 점검 루틴 (분기 1회 권장)
1. `npm audit` → 의존성 알려진 취약점 확인, `npm audit fix`.
2. 새 API 라우트 추가 시 체크: **변경(POST/PUT/PATCH/DELETE) 핸들러에 `auth()` 가드가 있는가.**
3. `grep -rn dangerouslySetInnerHTML components app` → 0건 유지(불가피하면 DOMPurify 경유).
4. `git ls-files | grep -i '\.db$'` → DB 파일이 추적되지 않는지 확인(현재 0건).
5. 공개 쓰기 엔드포인트(건의/게시글/댓글/신고/스낵)에 `checkContent()` 필터·길이 제한 적용 여부.

---

## 3. 이번 배포에 포함된 변경 (참고)
`SECURITY_REPORT.md`의 "조치 결과" 표 참조. 코드 8개 파일 + `.gitignore`/`.env.example` 수정.
DB 파일(`dev.db`, `prisma/dev.db`)은 git 추적에서 제거됨(로컬 파일은 보존, 원격 이력에서만 제외).

# ⚠️ 계정 인수인계 — 이걸 잃으면 사이트 전체를 잃는다

`kaist.mesc@gmail.com` 구글 계정 하나에 다음이 전부 묶여 있다.

- **Vercel** — 호스팅·배포
- **Turso** — 프로덕션 DB
- **Google Cloud** — OAuth 클라이언트 (Drive 행사사진 동기화)
- **Vercel Blob** — 사진/파일·백업 저장소
- **Google Sheets / Calendar** — 과비 확인, 예산, 학과 일정

이 계정 접근이 끊기면 GitHub에 코드가 남아 있어도 배포·DB·이미지·연동이 전부 멈춘다. 회장단이 바뀔 때마다 반드시 아래를 확인할 것.

## 인수인계 체크리스트

- [ ] 비밀번호 변경
- [ ] 복구 이메일 갱신
- [ ] 복구 전화번호 갱신
- [ ] 2단계 인증 백업 코드 재발급
- [ ] 2단계 인증 기기(휴대폰 등) 이전
- [ ] Vercel 프로젝트에 신임 담당자 초대 후 전임자 권한 정리
- [ ] Turso org 멤버 확인·정리

## Google OAuth 동의화면 승격 (권장)

Drive 동기화용 OAuth 클라이언트가 "테스트" 상태로 남아 있으면 refresh token이 **7일마다 만료**되어 주기적으로 재인증해야 한다. "게시됨"으로 승격하면 이 문제가 사라진다.

경로: Google Cloud Console → APIs & Services → OAuth consent screen → Publishing status → **Publish App**

## 주간 자동 백업

`/api/cron/backup` (본 저장소, `vercel.json`의 cron 설정으로 매주 일요일 20:00 UTC 자동 호출)이 Turso DB의 전 테이블을 JSON으로 덤프해 Vercel Blob에 `backups/backup-YYYY-MM-DD.json`(private 접근)으로 저장한다. 이 라우트가 동작하려면 Vercel 환경변수에 `CRON_SECRET`(임의의 긴 랜덤 문자열)이 설정돼 있어야 하며, 없으면 매번 401을 반환해 백업이 조용히 실패한다 — 배포 후 반드시 확인할 것.

복원이 필요하면 Vercel 대시보드 → Storage → Blob에서 해당 날짜 파일을 내려받아(또는 `BLOB_READ_WRITE_TOKEN`으로 `@vercel/blob`의 `list()`/`get()` 사용) JSON을 열어보고, 필요한 테이블만 골라 수동으로 Turso에 재삽입한다. 자동 복원 스크립트는 없다 — 이 백업은 "전멸 방지용 최후 스냅샷"이지 원클릭 복구 도구가 아니다.

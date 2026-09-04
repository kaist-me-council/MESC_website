<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 변경 내역

- 2026-07-05: KAIST 학과 사이트 크롤링으로 교수진 59명·학부과목 64개 시드
- 2026-07-05: navbar 공지사항·커뮤니티 드롭다운 그룹(각 4개 하위 항목) 추가 + 딥링크 연동(`/notices?category=`, `/community?tab=`)
- 2026-07-05: 드롭다운 활성/hover 스타일 절제 + 트랜지션 프로퍼티 명시 폴리시
- 2026-07-05: 강의평(별점+댓글) 기능 — CourseReview 모델·API·과목 상세 UI
- 2026-07-05 모바일 UI 개편 — 메뉴 1열 리스트화 + 터치 타깃·오버플로 전면 점검
- 2026-07-05 모바일 메뉴 카드 그리드 복원(1열 리스트 롤백) + 스크롤 불가 수정 — sticky 헤더에 갇혀 하단 그룹 접근 불가였던 것을 메뉴 패널 `max-h-[calc(100dvh-4rem)] overflow-y-auto`로 해소, 넓은 폭 카드 비대화 방지(반응형 열 수 3→4→6)
- 2026-09-02 개인정보·보안 정리 — `/privacy`·`/terms` 페이지 신설(푸터 링크 404 해소), 주간 백업 AES-256-GCM 암호화(키=sha256(CRON_SECRET), 복호화 `scripts/decrypt-backup.mjs`) + 보유기간 자동 정리(건의 연락처 답변 후 30일·IP 해시 90일·신고 180일), 업로드 이미지 sharp 재인코딩(EXIF/GPS 제거·실제 이미지 검증)·랜덤 suffix, 교수 전화번호 공개 응답 제외, `ANON_SALT` 프로덕션 필수(미설정 시 실패)·후기 비밀번호 scrypt 전환, 관리자 세션 7일, 과비 API 에러 문구·no-store
- 2026-09-02 공개 트래픽 대비 — 홈(60s)·학과정보·구성원(300s) ISR 전환, 공개 GET API 6개에 CDN 캐시 헤더(s-maxage=60), 과비 전역 일일 상한 5천→5만, next/image `sizes` 지정
- 2026-09-03 학생회 구성원 명단 20명·사진 20장 프로덕션 반영(사진은 512px webp로 `/api/upload` 경유 → Blob, Drive 폴더 미참조). 업로드 API 500 수정 — sharp의 linux-x64 바이너리·libvips가 Vercel 함수에 추적되지 않아 라우트 로드 시 실패하던 것을 `next.config.ts` `outputFileTracingIncludes`로 명시(bc4c971). Vercel에서 sharp 쓰는 라우트를 추가하면 같은 항목에 경로를 추가할 것
- 2026-09-04 공지 고정/해제가 수정 후 반영 안 되던 버그 — 원인은 9/2에 넣은 공개 GET API 6개의 CDN 캐시 헤더(`s-maxage=60, swr=300`). DB 저장은 정상이었지만 관리자 목록·/notices가 Vercel 엣지의 옛 응답을 받아 고정 상태가 그대로 보였고, 그 stale 값이 수정 폼에 다시 채워져 재저장 시 되돌아가기도 함. 이 헤더는 쓰기 시 purge할 방법이 없고, POST/PUT이 같이 있는 route.ts는 Next가 ISR로 만들지 못하므로(`hasNonStaticMethods`) 6개 GET 모두 헤더 제거. 공지 POST/PUT/DELETE에 `revalidatePath("/")` 추가(홈 60s ISR 즉시 갱신)

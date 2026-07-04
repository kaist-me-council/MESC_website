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

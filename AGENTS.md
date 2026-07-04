<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 변경 내역

- 2026-07-05: KAIST 학과 사이트 크롤링으로 교수진 59명·학부과목 64개 시드
- 2026-07-05: navbar 공지사항·커뮤니티 드롭다운 그룹(각 4개 하위 항목) 추가 + 딥링크 연동(`/notices?category=`, `/community?tab=`)
- 2026-07-05: 드롭다운 활성/hover 스타일 절제 + 트랜지션 프로퍼티 명시 폴리시
- 2026-07-05: 강의평(별점+댓글) 기능 — CourseReview 모델·API·과목 상세 UI

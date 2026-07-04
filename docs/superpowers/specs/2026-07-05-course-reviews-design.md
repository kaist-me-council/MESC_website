# 강의평 (Course Reviews) 설계

날짜: 2026-07-05
상태: 승인됨

## 목표

`/courses/[code]` 과목 상세 페이지에 학생들이 별점과 댓글로 강의 평가를 남길 수 있는 기능을 추가한다. 학생 로그인이 없는 사이트이므로 닉네임+비밀번호 방식(기존 자유게시판/댓글과 동일 패턴)을 사용한다.

## 데이터 모델

`CourseReview` (신규, 기존 Comment/Post 모델의 필드 관례를 그대로 따름 — 비밀번호 저장 방식은 기존 Comment 구현과 동일하게):

- `id` Int PK autoincrement
- `courseId` Int FK → Course (onDelete: Cascade)
- `rating` Int (1~5, 서버 검증)
- `content` String (길이 제한은 기존 Comment와 동일 수준)
- `nickname` String (기존 패턴과 동일 제한)
- 비밀번호 필드: 기존 Comment/Post가 쓰는 필드명·해싱 유틸 그대로 재사용
- `createdAt`, `updatedAt`

마이그레이션: `20260705*_add_course_review` (ALTER 없음, 테이블 추가만).

## API (컨트랙트 — 프런트는 이 형태에 맞춰 개발)

기존 `/api/posts`·comments 라우트의 검증(lib/validation.ts)·에러 응답 관례를 그대로 따른다.

- `GET /api/courses/[id]/reviews` → `{ reviews: [{id, rating, content, nickname, createdAt}], average: number|null, count: number }` (비밀번호 필드 제외, 최신순)
- `POST /api/courses/[id]/reviews` body `{nickname, password, rating, content}` → 생성. rating 1~5 정수, content/nickname 필수·길이 검증.
- `PUT /api/course-reviews/[id]` body `{password, rating?, content?}` → 비밀번호 일치 시 수정
- `DELETE /api/course-reviews/[id]` body `{password?}` → 비밀번호 일치 **또는 관리자 세션(auth())**이면 삭제
- courses 목록/상세 API에 평균 별점·개수 포함 (`_avg` 집계 또는 include 후 계산 — 기존 코드 스타일에 맞게)

신고: 기존 Report 모델 `targetType`에 `"courseReview"` 추가, 기존 신고 API·관리자 신고 처리 흐름에 편입.

## UI

- **과목 상세** (`/courses/[code]`): 하단에 "강의평" 섹션 — 평균 별점 + 개수 헤더, 리뷰 목록(별점·닉네임·날짜·내용·수정/삭제/신고 버튼), 작성 폼(별점 선택 + 닉네임/비밀번호/내용). 별점 입력·표시는 행사 피드백(EventFeedback)의 별 UI 패턴 재사용.
- **과목 목록** (`/courses`): 카드에 평균 별점(별 아이콘 + 숫자)과 리뷰 수 표시 (리뷰 0건이면 미표시).
- 수정/삭제는 비밀번호 입력 모달/인라인 — 기존 게시판 댓글의 UX 패턴 그대로.
- i18n: ko/en 라벨 추가 (`courses.reviews*` 네임스페이스).

## 관리

- 관리자 세션이면 API 레벨에서 비밀번호 없이 삭제 가능.
- 신고된 강의평은 기존 관리자 신고 목록에서 처리 (별도 admin 페이지 신설 없음 — YAGNI).

## 구현 주의

- 디자인은 DESIGN_SYSTEM.md와 기존 카드·폼 스타일 준수, 새 시각 언어 만들지 않기.
- 프로덕션(Turso) 마이그레이션은 기존 `prisma/libsql-migrate.mjs` 흐름으로 별도 단계에서 적용.

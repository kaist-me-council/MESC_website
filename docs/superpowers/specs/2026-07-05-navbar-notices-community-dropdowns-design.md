# Navbar 공지사항·커뮤니티 드롭다운 설계

날짜: 2026-07-05
상태: 승인됨

## 목표

Navbar의 단독 링크인 공지사항(`/notices`)과 커뮤니티(`/community`)를 기존 3개 그룹(강의 관련, 일정·재정, 학과 도우미)과 동일한 드롭다운 그룹으로 전환한다. 각 그룹은 하위 항목 4개를 가진다.

## 하위 항목 구성

### 공지사항 그룹 (기존 페이지 내 카테고리 필터 = 4조각)

| 항목 (ko / en) | href |
|---|---|
| 전체 / All | `/notices` |
| 공지 / Notice | `/notices?category=notice` |
| 행사 / Events | `/notices?category=event` |
| 학사 / Academic | `/notices?category=academic` |

### 커뮤니티 그룹 (기존 페이지 내 탭 = 4조각)

| 항목 (ko / en) | href |
|---|---|
| 갤러리 / Gallery | `/community?tab=gallery` |
| 건의함 / Suggestions | `/community?tab=suggestions` |
| 자유게시판 / Board | `/community?tab=board` |
| 간식 위시리스트 / Snack Wishlist | `/community?tab=wishlist` |

URL 값은 영문 슬러그를 사용하고, 페이지 내부의 한글 탭 상태값("공지", "갤러리" 등)과 매핑한다.

## 변경 지점

1. **`components/Navbar.tsx`** — `navItems`의 `/notices`, `/community` 단독 링크(`type: "link"`)를 `type: "group"` 객체로 교체. 그룹 아이콘은 기존 아이콘 유지(Bell, MessageSquare), 하위 항목 아이콘은 lucide-react에서 의미에 맞게 선택. 렌더링 로직은 범용이므로 배열 외 수정 없음.
2. **`lib/i18n.ts`** — `ko.navbar` / `en.navbar` 양쪽에 그룹 라벨 키(`groupNotices`, `groupCommunity`)와 하위 항목 라벨 키 추가. 기존 `notices.*` 번역 키(전체/공지/행사/학사)는 목록 페이지 탭용이므로 그대로 두고, navbar 네임스페이스에 별도 키를 둔다.
3. **`app/notices/page.tsx`** — `?category=` 쿼리 파라미터로 초기 카테고리를 설정하고, 탭 전환 시 URL을 갱신(`router.replace`, 스크롤 유지). 슬러그 매핑: `notice→공지`, `event→행사`, `academic→학사`, 없거나 미지원 값→전체.
4. **`app/community/page.tsx`** — `?tab=` 쿼리 파라미터로 초기 탭을 설정하고, 탭 전환 시 URL 갱신. 슬러그 매핑: `gallery→갤러리`, `suggestions→건의함`, `board→자유게시판`, `wishlist→간식 위시리스트`, 없거나 미지원 값→갤러리.

## 구현 주의사항

- Next.js App Router에서 클라이언트 컴포넌트가 `useSearchParams()`를 쓰면 해당 컴포넌트를 `<Suspense>` 경계로 감싸야 빌드 오류(CSR bailout)가 없다. 페이지 구조에 맞게 처리한다.
- 탭 전환 시 URL 갱신은 `router.replace(..., { scroll: false })`로 히스토리 오염과 스크롤 점프를 피한다. 기본 탭(전체/갤러리) 선택 시에는 쿼리를 제거해 URL을 깨끗하게 유지한다.
- 디자인 시스템(DESIGN_SYSTEM.md)과 기존 드롭다운 그룹의 스타일·인터랙션을 그대로 따른다 (신규 스타일 없음).

## 검토한 대안

- 커뮤니티 탭을 별도 라우트(`/community/gallery` 등)로 분리: 리팩토링 규모 대비 사용자 체감 이득이 없어 기각. 쿼리 파라미터 방식 채택.
- 공지사항 그룹을 인접 페이지 묶음(캘린더·과비 확인 등)으로 구성: 기존 그룹(일정·재정)이 빈약해지므로 기각.

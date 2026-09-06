# 학생회 이벤트 v3 — 홈 고정 · 입금자명 · 정산 · 주문번호 조회 · 주문 항목 수정 · 설명 링크

작성일 2026-09-07 · v2(`2026-09-07-campaign-v2-design.md`)의 증분. 사용자 요청 6건 전부 구현.

## 0. 요청 (사용자)
1. 홈 상단 카드 3개 자리에 **학생회 이벤트** 고정.
2. 신청서에 **입금자명** 칸 (비우면 이름과 동일).
3. 관리자 **정산 카드** (입금 확인 금액·대기 금액·수령 벌 수).
4. **주문번호로 조회**.
5. 관리자 **주문 항목 수정** (교환 처리용).
6. 설명란 **링크 자동·줄바꿈**.

## 1. 스키마 (`20260907000005_campaign_v3`)
```prisma
model CampaignOrder { depositorName String? }   // 입금자명. null = 이름과 동일
```

## 2. API
| 메서드·경로 | 변경 |
|---|---|
| `POST /api/campaigns/[slug]/orders` | body `depositorName?` (문자열 50자, 공백이면 null). `publicOrder` 에 `depositorName` 포함 |
| `POST /api/campaigns/[slug]/lookup` | `{ orderNo }` 단독 허용 (대문자 정규화, 해당 캠페인 주문만). 기존 `{ name, studentId\|email }` 도 유지. 응답 동일 `{ orders }` |
| `POST /api/campaigns/[slug]/orders/cancel`, `PUT .../confirm` | 본인 확인에 `{ orderNo }` 단독도 허용(조회와 같은 규칙: orderNo 가 오면 그것만으로 본인) |
| `PUT /api/admin/campaigns/[id]/orders` | 단건 body 에 `items?: [{ optionId, qty }]`, `depositorName?` 추가. items 가 오면: 옵션이 이 캠페인 소속·enabled 인지 검증, qty ≥ 1, 항목 재구성(group·name·unitPrice 는 주문의 affiliation 기준 `unitPrice`), total 재계산. 재고는 검사하지 않음(관리자 판단). 응답 `{ order }`(관리자 행 형태) |
| `GET /api/admin/campaigns/[id]/orders` | 행에 `depositorName`. CSV 열 "입금자명" 을 "이름" 다음에 |

`lib/campaign.ts`: `findOwnOrders` 가 `{ orderNo }` 를 받으면 orderNo 로만 찾는다. `publicOrder`·관리자 행에 depositorName.

## 3. 공개 화면
- `/apply/[slug]` 신청자 정보에 **입금자명 (선택)** 입력. placeholder "비우면 이름과 동일". 완료 카드에 "입금자명: X" 표시(없으면 이름).
- "내 신청 확인"·`/confirm` 조회 폼에 세 번째 모드 **주문번호로**: 입력 하나(orderNo). i18n `apply.modeOrderNo`, `apply.orderNoPlaceholder` 등.
- 설명(description/En)·afterNote·confirmNote 렌더링: `whitespace-pre-wrap` + URL 자동 링크(`https?://\S+` → `<a target=_blank rel=noopener>`). 공용 컴포넌트 `components/linkify-text.tsx` (`<LinkifyText text=… />`, 순수 정규식, 의존성 없음).
- 홈 `components/home-client.tsx` features 배열 4번째: `{ href: "/apply", icon: Ticket, label: t("features.events.label"), desc: t("features.events.desc"), lightColor: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300" }`. i18n `features.events` ko `{ label: "학생회 이벤트", desc: "단체복·행사 신청과 내 신청 확인" }`, en `{ label: "Council Events", desc: "Sign up for merch & events, check your order" }`. 그리드는 이미 `lg:grid-cols-4`.

## 4. 관리자 화면 (`orders-tab.tsx`)
- 상단 **정산 카드** 4개: 입금 확인 금액(paid+delivered 의 total 합), 입금 대기 금액(pending 합), 수령 완료 벌 수(delivered 의 qty 합), 취소 건수. 원화 `toLocaleString("ko-KR")`. 현재 필터가 아니라 전체 기준.
- 행에 입금자명 표시(이름과 다를 때만 "입금자명: X" 강조).
- **항목 수정**: 행의 "항목 수정" 버튼 → 인라인 편집기(각 줄: 옵션 `<select>`(그룹·이름·가격), 수량 input, 삭제; "줄 추가"; 합계 미리보기; 저장/취소) → `PUT { orderId, items }` → 목록 갱신. 캠페인 옵션 목록은 이미 상세 페이지에 있는 `c.options` 를 props 로 받는다.
- 관리자 메모 옆에 입금자명 수정도 가능(prompt 대신 인라인 input 이면 더 좋음, 최소 구현 허용).

## 5. 문서
- e2e 에 추가: depositorName 저장·조회, orderNo 단독 lookup/cancel/confirm, items 수정 후 total 재계산, 잘못된 optionId 400.
- 별도 **개발 기록 문서** `docs/superpowers/specs/2026-09-07-campaign-dev-log.md`: 사용자 요청 → 결정 → 구현 → 검증을 라운드별로 정리(부모가 작성).

## 6. 분담
1. 백엔드: §1, §2, e2e.
2. 공개 화면: §3 (linkify 컴포넌트 포함, 홈 카드, i18n).
3. 관리자 화면: §4.

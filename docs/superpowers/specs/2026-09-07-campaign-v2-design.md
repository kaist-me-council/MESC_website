# 학생회 이벤트 v2 — 수령 확인 흡수 · 굿즈 상품형 화면 · 취소/일괄 처리

작성일 2026-09-07 · `2026-09-07-campaign-system-design.md`(v1)의 증분. v1 계약은 아래에 적힌 변경 외에는 그대로.

## 0. 결정 사항 (사용자)
1. 반팔티 1차 "구매 확인"은 별도 기능이 아니라 **캠페인의 수령 확인 기능**이 된다. "2026 상반기 단체복 구매" 캠페인을 만들고 배부 시트를 그 캠페인의 주문으로 적재한다. `PriorPurchase` 모델·`/shop/check`·`/admin/shop`·`/api/shop/*`·`/api/admin/shop/*` 는 제거(`/shop/check` 는 리다이렉트만 남김).
2. 옷 같은 굿즈는 **상품형 화면**(이미지, 색상 칩, 사이즈 칩, 수량)으로 보여 준다. 캠페인 하나 = 상품 하나. 장바구니형 다상품은 안 함.
3. 관리자: **입금 취소**(paid→pending), **다중 선택 일괄 상태 변경**.
4. 신청자: **본인 신청 취소**(입금 전 pending 만. paid 이후는 "학생회에 문의").
5. 디자인 품질에 신경 쓴다(모바일 우선, DESIGN_SYSTEM.md).

## 1. 스키마 변경 (`20260907000003_campaign_v2`)

```prisma
model Campaign {           // 추가 필드
  kind            String   @default("signup")  // "goods" | "signup"
  imageUrl        String?                      // 대표 이미지 (기존 /api/upload 로 업로드한 URL)
  confirmEnabled  Boolean  @default(false)     // 수령 확인 받기
  confirmDeadline DateTime?
  confirmNote     String?                      // 확인 페이지 상단 안내
  confirmNoteEn   String?
}
model CampaignOrder {      // 추가 필드
  source        String   @default("web")      // "web" | "import"
  confirmation  String?                       // "received" | "not_received" | null
  resolution    String?                       // JSON Resolution[] (v1 tshirt: {optionId, group, name, qty, choice: pickup|refund|exchange, exchangeName?})
  confirmNote   String?                       // 신청자가 확인 때 남긴 말
  confirmedAt   DateTime?
}
```
SQL: `ALTER TABLE ... ADD COLUMN` ×9, `DROP TABLE IF EXISTS "PriorPurchase"` (인덱스 포함). `lib/tshirt.ts` 는 `studentIdHash` 와 `parseDistributionCsv` 연결만 남기고 `CHECK_DEADLINE`·`publicRecord`·`Resolution` 제거. `lib/tshirt-parse.ts` 는 유지(테스트 포함).

## 2. 헬퍼 추가 (`lib/campaign.ts`)
- `publicCampaign` 에 `kind, imageUrl, confirmEnabled, confirmDeadline, confirmNote, confirmNoteEn, confirmOpen(bool: confirmEnabled && (confirmDeadline ?? ∞) > now)` 포함.
- `publicOrder` 에 `orderNo, status, items, total, createdAt, affiliation, name, source, confirmation, resolution, confirmNote, confirmedAt, canCancel(status==="pending" && campaign open 여부 무관)` 포함.
- `ensureOptions(campaignId, pairs: {group, name}[])`: 없는 (group,name) 옵션을 만들어 id 맵 반환(가격 0, 재고 null, enabled true). import 용.
- `importOrders(campaign, rows)`: rows = `{affiliation,name,studentIdHash,email,phone,items:[{group,name,qty}],status}` → 옵션 매핑 → total = Σ unitPrice×qty → createMany(source "import").
- `parseGenericOrdersCsv(text, hash)`: 헤더 `구분,이름,학번,전화,이메일,항목,상태` — 항목 = `"흰색 XL×1; 검정 L×2"` (`×` 또는 `x`, `;`/`,` 구분), 상태 = 대기|입금|수령|취소 → pending|paid|delivered|cancelled (빈칸=paid). 문제 행은 problems[].
- `tshirtRowsToOrders(rows: ImportRow[])`: 배부 시트 파서 결과 → group 흰색/검정, name 사이즈, status = pickedUp ? delivered : paid.

## 3. API 변경

### 공개 (모두 IP 레이트리밋 "apply" 20/분, no-store)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `POST /api/campaigns/[slug]/lookup` | (v1과 동일) | `{ orders: publicOrder[] }` — confirmation 필드 포함 |
| `POST /api/campaigns/[slug]/orders/cancel` | `{ orderNo, name, studentId? \| email? }` | 본인 일치 + status pending → cancelled, `{ order }`. paid/delivered 면 409 `{ error: "입금 확인 후에는 학생회에 문의해 취소해주세요." }` |
| `PUT /api/campaigns/[slug]/confirm` | `{ orderNo, name, studentId? \| email?, confirmation: "received"\|"not_received", resolution?: [{optionId, choice, exchangeName?}], note? }` | confirmEnabled 아니면 404, 마감 지나면 403. resolution 은 주문 items 와 optionId 로 1:1 매칭해 서버가 재구성. `{ order }` |

### 관리자
| 메서드·경로 | 변경 |
|---|---|
| `PUT /api/admin/campaigns/[id]/orders` | `{ orderId, status?, adminMemo?, confirmation? }` **또는** `{ orderIds: number[], status }` (일괄). status 는 4개 중 아무 값으로나 변경 가능(입금 취소 = pending). 일괄은 `{ updated: n }` |
| `POST /api/admin/campaigns/[id]/orders/import` | `{ csv, mode: "tshirt"\|"generic", replace?: bool, dryRun?: bool }` → dryRun: `{ count, problems, preview: 5건(해시 제외), newOptions: [{group,name}] }`, 실행: `{ imported, problems, createdOptions }`. replace 면 source==="import" 인 주문만 삭제 후 적재(웹 주문은 보존) |
| `GET /api/admin/campaigns/[id]/orders` | 응답 행에 `source, confirmation, resolution, confirmNote, confirmedAt` 추가. CSV 열에도 "출처, 수령확인, 처리선택, 확인메모, 확인시각" 추가 |
| `PUT /api/admin/campaigns/[id]` | v1 + 새 필드 |
| `POST /api/admin/campaigns` | body 에 `preset: "tshirt-2026-spring"` 이 오면 아래 프리셋으로 생성 |

프리셋 `tshirt-2026-spring`: slug `2026-spring-tshirt`, title "2026 상반기 기계과 반팔티", kind goods, enabled true, closesAt 2026-06-30 (신청 닫힘), confirmEnabled true, confirmDeadline 2026-09-13T23:59:59+09:00, confirmNote "상반기에 주문하신 반팔티를 받으셨는지 확인해 주세요. 못 받은 항목은 재고가 있으면 학생회실(N7)에서 드리고, 없으면 환불 또는 교환해 드립니다. 환불 계좌는 개별 연락으로 받습니다.", 옵션 흰색/검정 × S,M,L,XL,2XL,3XL,4XL (price 0, stock null). 이미 slug 가 있으면 409.

### 제거
`app/api/shop/check`, `app/api/admin/shop/prior`, `app/admin/(protected)/shop`, 대시보드 "반팔티 구매 확인" 카드. `app/shop/check/page.tsx` 는 `redirect("/apply/2026-spring-tshirt/confirm")` 만.

## 4. 공개 화면

### `/apply/[slug]` (v1 개선)
- **kind === "goods"**: 상품형. 상단에 이미지(없으면 브랜드 그라디언트 플레이스홀더 + 아이콘), 제목, 기간, 설명. **색상 칩**(그룹) → **사이즈 칩**(옵션 name; 남은 수량 표시, 품절 회색·취소선) → 수량 스테퍼 → "담기". 담은 목록(색상·사이즈·수량·금액, 삭제). 모바일에서 하단 고정 바(합계 + "신청하기"). 신청자 정보는 담기 후 펼쳐지는 섹션.
- **kind === "signup"**: v1 목록형 유지, 스타일만 정돈.
- 완료 카드: 주문번호 크게 + 복사 버튼, 합계, 계좌(복사 버튼), afterNote, "캡처해 두세요".
- "내 신청 확인": 주문 카드마다 상태 뱃지(대기/입금 확인/수령 완료/취소), pending 이면 **신청 취소** 버튼(두 단계: "취소" → "정말 취소할까요? [네, 취소]" 인라인, 모달 없음), paid 이후면 "입금 확인 후 취소는 학생회에 문의" 문구. 캠페인에 confirmEnabled 면 "수령 확인하러 가기" 링크.

### `/apply/[slug]/confirm` (신규 — 옛 /shop/check 이식)
- confirmEnabled 아니면 "확인 기간이 아닙니다" 카드. 상단 마감 배너(confirmDeadline), confirmNote.
- 조회 폼(학번으로 / 이메일로 토글, 이름) → 주문 카드: 항목(색상·사이즈·수량), 배부 기록(status delivered → "수령 완료로 기록됨", 아니면 "수령 전으로 기록됨") → **받았어요 / 못 받았어요** → 못 받음이면 항목별 "학생회실 수령 / 환불 희망 / 다른 사이즈로 교환(같은 그룹의 옵션 name 선택)" → 메모 → 제출/수정. 마감 후 잠금. 기존 `shopCheck.*` i18n 키를 `confirm.*` 로 옮겨 재사용.

### 내비·목록
- `/apply` 카드에 kind 뱃지(굿즈/신청), 이미지 썸네일(goods), 열림/마감/확인 진행 중 뱃지.
- 디자인: `make-interfaces-feel-better` 스킬 로드 후 작업. 칩은 44px 이상 터치 타깃, 상태 색은 DESIGN_SYSTEM 팔레트, 로딩 스켈레톤, 빈 상태 일러스트 대신 아이콘+한 줄.

## 5. 관리자 화면

### `/admin/campaigns`
- "새 캠페인" 외에 **프리셋 버튼 "상반기 반팔티(수령 확인용) 만들기"** → POST preset → 상세로 이동. 목록에 kind 뱃지, 확인 응답 수(응답/전체).

### `/admin/campaigns/[id]` 설정 탭 추가 필드
- 종류(굿즈/일반 신청), 대표 이미지(파일 선택 → 기존 `POST /api/upload`(FormData `file`) → 반환 url 저장, 미리보기), 수령 확인(스위치, 마감, 안내문 ko/en).

### `/admin/campaigns/[id]` 신청 목록 탭
- 행마다 **체크박스** + 헤더 전체 선택. 선택 시 상단 고정 바 "n건 선택: [입금 확인] [입금 취소] [수령 완료] [대기로] [취소] [선택 이메일 복사]".
- 행 상태 버튼: 대기→입금 확인→수령 완료, 각 단계 되돌리기(입금 취소 = 대기로), 취소/복구.
- 필터 카드: 전체/대기/입금/수령/취소 + (confirmEnabled 면) 미응답/받음/못 받음. 검색.
- **못 받음 집계** 카드(그룹·이름·선택별 벌 수), 옵션별 합계(발주표).
- **주문 적재** 섹션: 파일/붙여넣기, 모드(배부 시트 / 일반 CSV), "import 주문만 교체" 체크, 미리보기(문제 행·새로 생길 옵션 표시) → 적재.
- 이메일 복사(현재 필터), CSV.
- 행에 출처(import) 뱃지, 확인 응답 뱃지, 처리 선택·확인 메모 표시.

## 6. 문서·기타
- 처리방침 문구는 v1에서 이미 일반화됨. `AGENTS.md` 기록.
- e2e `scripts/campaign-api.test.sh` 에 추가: preset 생성, tshirt 모드 import(dryRun→실행, 새 옵션 없음), confirm PUT(받음/못 받음+교환), 본인 취소(pending ok, paid 409), 일괄 상태 변경, 입금 취소.
- 반팔티 문서의 "1단계" 절차는 `/admin/campaigns` 프리셋 + 적재로 바뀜(사용자 안내는 채팅으로).

## 7. 분담
1. **백엔드**: §1–3, e2e, `/shop/check` 리다이렉트, 구 API 삭제, lib/tshirt.ts 정리.
2. **공개 화면**: §4, i18n(`confirm.*` 신설·`shopCheck.*` 제거·`apply.*` 확장).
3. **관리자 화면**: §5, 대시보드 카드 정리, `/admin/shop` 삭제.

## 8. 조언 문서(`2026-09-07-google-form-advisor.md`) 반영 결정
- 사이즈 별칭은 import 때만 정규화(SS→S, XL(LL)→XL …). 공개 화면 옵션은 S~4XL 7개만.
- 단가는 옵션 `price` + 구분 `priceAdjust` 한곳. 과비 납부 여부에 따른 6,000원 정책은 캠페인에 넣지 않는다(과비 API 연동 안 함).
- 구글폼 문항 1:1 포팅 금지. "안 산다" 문항 없음, "입금했습니다" 체크 없음(상태는 관리자가 paid 로).
- 9/8 메일 링크 `/shop/check` 는 `/apply/2026-spring-tshirt/confirm` 리다이렉트. **프로덕션에 프리셋 캠페인 생성 + 배부 시트 적재가 끝난 뒤에만 메일 발송**(그 전엔 "확인 기간이 아닙니다" 카드가 뜸).

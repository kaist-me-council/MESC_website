# 학생회 이벤트(신청·구매 캠페인) 시스템 — 설계·계약

작성일 2026-09-07 · 반팔티 문서(`2026-09-07-tshirt-shop-design.md`)의 2단계를 일반화한 것. 구글폼 대체가 목표.

## 1. 한 줄 정의

관리자가 **캠페인**(제목·기간·계좌·옵션 목록)을 만들면 공개 신청 페이지 `/apply/[slug]`가 생긴다. 신청자는 옵션을 고르고 이름·학번(또는 이메일)·연락처를 적고, 금액과 입금 계좌를 안내받는다. 관리자는 신청 목록에서 입금·수령을 체크하고 CSV·이메일 목록을 뽑는다. 반팔티 2차 구매가 첫 캠페인. MT·체육대회·굿즈·간식 신청도 같은 틀.

**하지 않는 것**: 자유 질문 폼 빌더, PG 결제, 회원가입, 메일 자동 발송(이메일 복사 → Gmail 에서 발송).

## 2. 데이터 모델 (Prisma, SQLite/Turso)

```prisma
model Campaign {
  id            Int       @id @default(autoincrement())
  slug          String    @unique          // URL. 영문·숫자·하이픈
  title         String
  titleEn       String?
  description   String?                    // 일반 텍스트, 줄바꿈 유지
  descriptionEn String?
  enabled       Boolean   @default(false)  // 공개 여부 (draft 대신)
  opensAt       DateTime?                  // null = 즉시
  closesAt      DateTime?                  // null = 무기한
  bankInfo      String?                    // 완료·조회 화면에만 표시 (은행 계좌 예금주)
  afterNote     String?                    // 완료 화면 안내 (예: 수령은 종강 직전, 입금자명은 이름으로)
  afterNoteEn   String?
  allowQty      Boolean   @default(true)   // 옵션별 수량 선택 허용 (false = 옵션당 1)
  maxPerPerson  Int?                       // 1인 총 수량 상한 (null = 무제한)
  requireStudentId Boolean @default(true)  // false 면 이메일만으로 신청 가능
  priceAdjust   String?                    // JSON {"대학원생":1000,"교수님":2000} 구분별 가산 (옵션 price 에 더함)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  options       CampaignOption[]
  orders        CampaignOrder[]
}

model CampaignOption {
  id         Int      @id @default(autoincrement())
  campaignId Int
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  group      String?  // 표시 그룹 (예: "흰색")
  name       String   // 예: "XL"
  nameEn     String?
  price      Int      @default(0)  // 원. 0 = 무료 신청
  stock      Int?     // null = 무제한. 가용 = stock - (취소 제외 주문 수량 합)
  order      Int      @default(0)
  enabled    Boolean  @default(true)
  @@index([campaignId, order])
}

model CampaignOrder {
  id            Int      @id @default(autoincrement())
  campaignId    Int
  campaign      Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  orderNo       String   @unique   // "{slug 앞 4자 대문자}-{6자리 랜덤 영숫자}" 예: TSHI-7K2M9Q
  affiliation   String             // 학부생 | 대학원생 | 교수님 | 졸업생 | 기타
  name          String
  studentIdHash String?            // lib/tshirt.ts studentIdHash() — 원문 미저장
  email         String
  phone         String?
  items         String             // JSON [{optionId, group, name, qty, unitPrice}]
  total         Int
  status        String   @default("pending") // pending | paid | delivered | cancelled
  note          String?            // 신청자 메모
  adminMemo     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([campaignId, status])
  @@index([campaignId, studentIdHash])
  @@index([campaignId, email])
}
```

마이그레이션: `prisma/migrations/20260907000002_add_campaign/migration.sql` 수기 작성(`migrate dev` 불가). 로컬 dev.db 는 `sqlite3 dev.db < …` 로 적용.

## 3. 공용 헬퍼 `lib/campaign.ts` (서버)

- `AFFILIATIONS = ["학부생","대학원생","교수님","졸업생","기타"]`
- `isOpen(c)`: enabled && (opensAt ?? -∞) <= now < (closesAt ?? ∞)
- `availability(campaignId)`: Map<optionId, remaining | null> — stock null 이면 null, 아니면 stock − Σ qty(status ≠ cancelled)
- `unitPrice(option, campaign, affiliation)`: option.price + (priceAdjust[affiliation] ?? 0)
- `makeOrderNo(slug)`
- `publicCampaign(c, availability)`: 공개 응답 형태 (bankInfo 제외)
- `publicOrder(o)`: {orderNo, status, items, total, createdAt, affiliation, name} + campaign.bankInfo/afterNote (본인 조회·완료 화면용). studentIdHash·phone·adminMemo 제외

학번 해시는 `lib/tshirt.ts`의 `studentIdHash` 재사용. 레이트리밋은 `lib/rate-limit.ts` `enforce(ip, "apply", 20, 60_000)`.

## 4. API 계약

### 공개
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /api/campaigns` | – | `{ campaigns: [{ slug, title, titleEn, open: bool, opensAt, closesAt }] }` enabled 만, 최신순. `Cache-Control: private, no-store` |
| `GET /api/campaigns/[slug]` | – | `{ campaign: { slug, title, titleEn, description, descriptionEn, open, opensAt, closesAt, afterNote, afterNoteEn, allowQty, maxPerPerson, requireStudentId, priceAdjust: {구분: 가산}, options: [{ id, group, name, nameEn, price, remaining: number|null }] } }` enabled 아니면 404 |
| `POST /api/campaigns/[slug]/orders` | `{ affiliation, name, studentId?, email, phone?, note?, items: [{ optionId, qty }] }` | 201 `{ order: publicOrder }`. 검증: 열려 있음, 옵션 enabled, qty ≥1(allowQty false 면 1), Σqty ≤ maxPerPerson, remaining 충분(부족 시 409 `{ error, optionId }`), requireStudentId 면 studentId 필수, email 형식. total 은 서버가 계산 |
| `POST /api/campaigns/[slug]/lookup` | `{ name, studentId? \| email? }` (둘 중 하나) | `{ orders: publicOrder[] }` 이름 정규화 일치 + (해시 or 이메일) 일치. 없으면 빈 배열 |

### 관리자 (전부 `auth()` 필수, 401)
| 메서드·경로 | 설명 |
|---|---|
| `GET /api/admin/campaigns` | 목록 + 주문 수·입금 수 집계 |
| `POST /api/admin/campaigns` | 생성. body = Campaign 필드 + `options: [{group,name,nameEn,price,stock,order,enabled}]` |
| `GET /api/admin/campaigns/[id]` | 상세 + options |
| `PUT /api/admin/campaigns/[id]` | 수정. `options` 배열이 오면 id 있는 건 update, 없는 건 create, 빠진 건 delete(주문에 쓰인 옵션은 enabled=false 로만) |
| `DELETE /api/admin/campaigns/[id]` | 주문 0건일 때만 삭제, 아니면 409 |
| `GET /api/admin/campaigns/[id]/orders` | `{ orders: [...] }` 전체 필드(해시 제외, phone 포함). `?format=csv` → CSV 다운로드(주문번호, 상태, 구분, 이름, 이메일, 전화, 항목, 합계, 메모, 관리자메모, 신청시각) |
| `PUT /api/admin/campaigns/[id]/orders` | `{ orderId, status?, adminMemo? }` |

### 기존 `/api/admin/shop/prior` 
GET 응답에 이미 email 이 있음 → 관리자 화면에서 **이메일 복사** 버튼(필터된 행의 이메일을 쉼표로 join, 중복 제거, `navigator.clipboard.writeText`). 캠페인 주문 목록에도 동일 버튼.

## 5. 화면

### 공개 (한/영, `lib/i18n.ts` 에 `apply.*` 키)
- `/apply` — 캠페인 카드 목록. 열림/마감 뱃지. 없으면 안내.
- `/apply/[slug]` — 제목·설명·기간 → 옵션 그리드(그룹별, 가격, 남은 수량·품절, 수량 스테퍼 또는 체크) → 신청자 정보(구분 select, 이름, 학번/이메일, 전화, 이메일, 메모) → 합계(구분 가산 반영) → 신청. 성공 시 같은 페이지에서 완료 카드: 주문번호(크게), 합계, 계좌(bankInfo), afterNote, "이 화면을 캡처해 두세요". 하단에 "내 신청 확인" 접이식: 이름+학번/이메일 → 내 주문 상태.
- 내비게이션: `components/Navbar.tsx` 의 `groupHelper`(학과 도우미) 그룹에 `{ href: "/apply", label: t("navbar.events") }` 추가. 라벨 ko "학생회 이벤트" / en "Council Events". 아이콘 lucide `Ticket`.
- 모바일 우선. 디자인 시스템(`DESIGN_SYSTEM.md`) 준수, 기존 `/shop/check` 와 같은 카드 구성.

### 관리자 (한국어)
- `/admin/campaigns` — 목록(제목, 상태 열림/마감/비공개, 주문 수, 입금 수) + "새 캠페인". 대시보드 카드 추가(`Ticket` 아이콘, "학생회 이벤트", "신청·구매 캠페인 관리").
- `/admin/campaigns/[id]` — 탭 2개.
  - **설정**: 모든 Campaign 필드 + 옵션 표(그룹, 이름, EN, 가격, 재고, 순서, 사용). "옵션 일괄 추가" textarea: 한 줄에 `그룹,이름,가격,재고` (재고 비우면 무제한). 반팔티용 미리 채우기 버튼: 흰/검 × S~4XL 14줄.
  - **신청 목록**: 상태 카드(전체/대기/입금/수령/취소), 검색, 상태 토글 버튼, 관리자 메모, 옵션별 합계(발주표), **CSV 내보내기**, **이메일 복사**(현재 필터 기준).
- `/admin/shop`(1차 확인)에도 **이메일 복사** 버튼 추가(현재 필터 기준).

## 6. 개인정보·보안
- 학번 원문 미저장(해시). 계좌번호는 신청 완료·본인 조회 응답에만.
- 공개 API 레이트리밋 IP 20/분. 주문 생성은 same-origin 만(Origin 검사 불필요 — 기존 패턴 없음, 생략).
- 개인정보처리방침 항목을 "학생회 이벤트 신청·구매(/apply, /shop)"로 일반화. 보유: 캠페인 마감(closesAt) 후 180일 지나면 주문 삭제(백업 크론 `purgeExpired`).

## 7. 작업 분담 (병렬 3)
1. **백엔드**: schema + 마이그레이션 + `lib/campaign.ts` + 공개/관리자 API + 크론 + 처리방침 문구.
2. **공개 화면**: `/apply`, `/apply/[slug]`, i18n `apply.*` + `navbar.events`, Navbar 항목.
3. **관리자 화면**: `/admin/campaigns`, `/admin/campaigns/[id]`, 대시보드 카드, `/admin/shop` 이메일 복사.

통합 후: `npx tsc --noEmit`, `npm run build`, 로컬 `next start` 리허설(캠페인 생성 → 주문 → 조회 → 상태 변경 → CSV), 프리뷰 배포.

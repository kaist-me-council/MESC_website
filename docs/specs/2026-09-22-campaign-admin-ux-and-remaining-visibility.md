# 캠페인: 남은 자리 공개/비공개 + 관리자 설정 화면 UX 개편

작성일 2026-09-22 · 기획만(구현은 별도 작업자) · 기준 커밋 `feat/campaign-payment-gate`(PR #29)

두 가지를 한 묶음으로 본다. 설정에 스위치가 계속 늘어나서(유료 행사·행사 일시·문항·수령 확인)
지금 구조로 하나 더 넣으면 관리자 화면이 무너진다. 그래서 **A(기능)를 B(화면 재편) 안에 얹는다.**

---

## A. 남은 자리 공개/비공개

### 왜
- 학생 화면에 "남은 자리 49"가 항상 보인다. 정원이 많이 남은 게 드러나면 참여를 망설이게 되고,
  반대로 굿즈는 재고를 보여 주는 편이 낫다. 캠페인마다 다르다.
- 지금은 `remaining: null` 이 **"무제한"** 을 뜻한다. 여기에 "숨김"을 섞으면 안 된다.
  숨겨도 **품절은 반드시 보여야** 한다 — 안 그러면 학생이 제출하고 나서야 409를 만난다.

### 데이터
```prisma
model Campaign {
  showRemaining Boolean @default(true) // 남은 자리/수량을 학생 화면에 보여 줄지
}
```
마이그레이션: `prisma/migrations/2026092200000X_campaign_show_remaining/migration.sql`
```sql
ALTER TABLE "Campaign" ADD COLUMN "showRemaining" BOOLEAN NOT NULL DEFAULT true;
```

### 서버 (`lib/campaign.ts` · `publicCampaign`)
옵션 응답에 `soldOut` 을 **항상** 싣고, `remaining` 은 공개일 때만 싣는다.

```ts
options: c.options.filter(o => o.enabled).sort(...).map(o => {
  const left = avail.get(o.id) ?? null;            // null = 재고 무제한
  return {
    id: o.id, group: o.group, name: o.name, nameEn: o.nameEn, price: o.price,
    remaining: c.showRemaining ? left : null,      // 숨김이면 null
    soldOut: left !== null && left <= 0,           // 숨겨도 품절은 알려 준다
  };
}),
showRemaining: c.showRemaining,
```
`parseCampaignBody`: `showRemaining: b.showRemaining === undefined ? true : Boolean(b.showRemaining)`
(기존 `allowQty` 와 같은 "미지정이면 true" 규칙을 따른다.)

주의: 재고 검증·409 는 서버 트랜잭션(`app/api/campaigns/[slug]/orders/route.ts`)이 그대로 담당한다.
숨김은 **표시**만 바꾼다. 재고 자체를 숨기는 게 아니다.

### 학생 화면 (`app/apply/[slug]/page.tsx`, `goods-picker.tsx`)
- `soldOut` 으로 품절 표시·비활성 판단 (지금은 `remaining !== null && remaining <= 0` 으로 계산 중 → 교체)
- 잔여 문구: `showRemaining && remaining !== null` 일 때만 "남은 자리 N"(신청형) / "남은 수량 N"(굿즈)
- 수량 상한 `setQ` 의 `cap`: `remaining` 이 없으면 `maxPerPerson` 만으로 제한 (현재 로직에서 null 처리 그대로)

### 관리자
- 설정 화면 「참가비·정원」 섹션에 토글 **"남은 자리 공개"**(기본 켬).
  꺼져 있으면 옆에 회색 글씨로 "학생에게는 품절 여부만 보입니다."
- 관리자 목록·발주표는 영향 없음(항상 실제 수치를 본다).

### 수용 기준
1. `showRemaining=false` → 공개 API 의 모든 옵션 `remaining === null`, 화면에 잔여 문구 없음
2. 같은 상태에서 재고 0 옵션은 `soldOut: true` 이고 화면에 "품절" + 선택 불가
3. `showRemaining=true` 는 지금과 동일하게 동작 (신청형 "남은 자리", 굿즈 "남은 수량")
4. 숨김 상태에서도 재고 초과 신청은 409 로 막힌다
5. 기존 캠페인은 마이그레이션 후 전부 공개(=지금 동작 유지)

### 테스트 (`scripts/campaign-api.test.sh` v10 절)
- 재고 2인 옵션 캠페인 생성 → `showRemaining:false` 로 PUT
- 공개 상세: `remaining is None`, `soldOut is False`
- 2건 신청 → 공개 상세에서 `soldOut is True`, 3번째 신청 409
- `showRemaining:true` 로 되돌리면 `remaining == 0`

---

## B. 관리자 캠페인 설정 화면 UX 개편

대상: `app/admin/(protected)/campaigns/[id]/settings-tab.tsx` (현재 한 페이지에 카드 6개, 스크롤 길다)
참고: 토스(적은 선택지·큰 타이포·하단 고정 액션), 구글폼(카드 하나=한 덩어리, 문항 카드, 조건부 노출)

### 원칙 넷
1. **안 쓰는 칸은 안 보인다** — 유료 행사가 꺼져 있으면 계좌 입력이 없고, 굿즈가 아니면 사이즈 프리셋이 없다.
2. **한 화면에 한 관심사** — 섹션 앵커로 이동. 세로로 6카드를 늘어놓지 않는다.
3. **저장은 항상 같은 자리** — 하단 고정 바. 변경이 있을 때만 활성.
4. **학생에게 어떻게 보이는지 바로 안다** — 요약 3줄을 저장 바 옆에 둔다.

### 화면 구조
```
┌ 상단 고정 ─────────────────────────────────────────────┐
│ ← 캠페인 목록   2026 체육대회   [신청 ▾] [공개 ●]        │
│ [ 기본 ][ 일정 ][ 참가비·정원 ][ 문항 ][ 옵션 ][ 고급 ]   │ ← 앵커 칩(모바일 가로 스크롤)
└────────────────────────────────────────────────────────┘

 기본        제목 / 제목(EN) / 주소(slug) / 종류 / 설명 / 이미지
 일정        신청 시작 · 신청 마감 │ 행사 일시 · 장소   (+ "학생 화면 미리보기" 링크)
 참가비·정원  [유료 행사] 토글 → 켜면 아래가 펼쳐짐
               입금 계좌 · 완료 안내
             1인 최대 수량 │ [남은 자리 공개] 토글
 문항        구글폼식 카드 목록 + 하단 "문항 추가" 버튼 4종
 옵션        표(그룹·이름·가격·재고) + 일괄 추가 + (굿즈일 때만) 사이즈 프리셋
 고급        구분별 가산 금액 · 수령 확인 · 표시 순서
 위험 구역    캠페인 삭제 (빨간 테두리, 따로 떨어뜨림)

┌ 하단 고정 ─────────────────────────────────────────────┐
│ 학생에게: 계좌 보임 · 입금 체크 필수 · 남은 자리 숨김      │ ← 요약 3줄(상태 반영)
│                                   [되돌리기] [ 저장 ]    │
└────────────────────────────────────────────────────────┘
```

### 컴포넌트 분해 (파일)
지금 210줄짜리 단일 파일을 섹션별로 쪼갠다. 같은 폴더에:
```
settings-tab.tsx          // 셸: 앵커 칩 · 스크롤 스파이 · dirty 관리 · 저장 바
sections/basic.tsx
sections/schedule.tsx
sections/pricing.tsx      // 유료 행사·계좌·1인 최대·남은 자리 공개
sections/questions.tsx    // 지금 문항 편집기 이동 + 복제 버튼 추가
sections/options.tsx      // 옵션 표 + 일괄 추가 + 프리셋
sections/advanced.tsx     // 가산 금액 · 수령 확인 · 표시 순서 · 삭제
```
각 섹션은 `{ c, set, setC }` 만 받는 표현 컴포넌트로 두고, 저장·에러·dirty 는 셸이 소유한다.
(기존 `set`/`setC`/`readImages`/`readQuestions` 계약은 그대로 쓴다 — 저장 API 는 손대지 않는다.)

### 시각 규칙 (DESIGN_SYSTEM.md 위에서)
- 섹션 제목 `text-base font-semibold`, 섹션 간격 `space-y-8`, 카드 `rounded-2xl border-border/60`
- 라벨 `text-sm font-medium`, 도움말 `text-xs text-muted-foreground`, 입력 `h-11 rounded-xl`
- 체크박스 → **Switch** 로 교체(켜고 끄는 성격이 분명한 것: 공개, 유료 행사, 남은 자리 공개, 수량 선택, 학번 필수, 수령 확인)
- 조건부 영역은 즉시 사라지지 말고 `animate-in fade-in slide-in-from-top-1 duration-150`
- 위험 구역: `border-destructive/40 bg-destructive/5`, 버튼은 2단 확인(지금 방식 유지)
- 모바일 폭 360px 에서 앵커 칩이 가로 스크롤되고, 저장 바는 `env(safe-area-inset-bottom)` 을 더한다

### 동작 규칙
- **dirty guard**: 변경 후 탭 이동·뒤로가기 시 "저장하지 않은 변경이 있습니다" 확인
- **저장 바**: 변경 없으면 저장 비활성. 저장 중 `저장 중...`, 성공하면 토스트 1.5초 후 자동 소멸
- **서버 오류 표시**: 문항 ID 중복·선택지 없음 등 400 메시지는 **해당 섹션 앵커로 스크롤**하면서 그 카드에 빨간 테두리
- **요약 3줄** 계산: `requiresPayment ? "계좌 보임 · 입금 체크 필수" : "무료(계좌 비공개)"`,
  `showRemaining ? "남은 자리 보임" : "남은 자리 숨김"`, `questions.length ? "추가 문항 N개" : "추가 문항 없음"`
- 기존 경고(옵션 0개 공개 중 / 가격 있는데 유료 꺼짐)는 셸 상단에 그대로 유지

### 하지 않을 것
- 저장 API·데이터 모델 변경 (A 의 `showRemaining` 외에는 없음)
- 자동 저장, 실시간 미리보기 렌더(요약 3줄로 충분), 드래그 정렬 라이브러리 도입
  (문항 순서는 지금의 ↑↓ 버튼 유지)

### 수용 기준
1. 유료 행사 토글이 꺼져 있으면 계좌·완료 안내 입력이 화면에 없다. 켜면 그 자리에서 펼쳐진다.
2. 앵커 칩을 누르면 해당 섹션으로 스크롤되고, 스크롤에 따라 현재 섹션 칩이 강조된다.
3. 아무것도 바꾸지 않으면 저장 버튼이 비활성이다. 한 글자만 바꿔도 활성된다.
4. 저장 실패(400) 시 해당 섹션으로 이동하며 오류 문구가 그 카드 안에 뜬다.
5. 360px 폭에서 가로 스크롤이 생기지 않고, 저장 바가 홈 인디케이터를 가리지 않는다.
6. 기존 기능(이미지 8장·문항 4종·옵션 일괄 추가·프리셋·삭제·수령 확인)이 전부 그대로 동작한다.

### 검증 방법
- `npx tsc --noEmit`, `npm test`, `bash scripts/campaign-api.test.sh http://localhost:3100` (v10 절 추가분 포함)
- 헤드리스 크롬 + CDP 로 관리자 로그인 후: 유료 토글 → 계좌 칸 등장, 문항 추가 → 저장 → DB 반영,
  남은 자리 끄고 학생 화면에서 잔여 문구가 사라지는지까지 한 번에 확인
  (세션 쿠키는 `curl` 로 로그인해 받은 `authjs.session-token` 을 `Network.setCookie` 로 주입하면 된다)

---

## 작업 순서 제안
1. A 를 먼저 (스키마·서버·학생 화면·테스트) — 작고 독립적이다
2. B 는 섹션 분해 → 셸(앵커·저장 바·dirty) → 조건부 노출 → 위험 구역 순
3. A 의 "남은 자리 공개" 토글은 B 의 `sections/pricing.tsx` 에 자연스럽게 들어간다

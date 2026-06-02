# 사이트 설정(Site Settings) 관리 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하드코딩된 사이트 콘텐츠(운영시간 / 연락처·위치 / 외부링크·SNS / 동아리 소개)를 관리자 페이지(`/admin/site`)에서 직접 편집 가능하게 만든다.

**Architecture:** 기존 컨벤션(PopupSettings 싱글톤 + PopupLink 리스트 + Member)을 그대로 확장한다. DB 모델 3개(SiteSettings·SiteLink·Club) → API 라우트(GET 공개 / 쓰기 인증) → 관리자 탭 UI → 공개 페이지가 lib 상수 대신 DB에서 읽도록 전환. 전환 후에도 외관이 동일하도록 현재 하드코딩 값을 시드한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma v7 + libSQL(SQLite), NextAuth v5, shadcn/ui, Tailwind CSS.

> **테스트 정책:** 이 저장소에는 테스트 프레임워크가 없다(vitest/jest 미설치). 사용자/코드베이스 컨벤션이 우선하므로, 검증 게이트는 **`npx tsc --noEmit`(타입) + `npm run lint`(린트) + dev 서버 수동 확인**으로 한다. 순수 로직 모듈(`lib/site-settings.ts`)에 한해 의존성 없이 `node`로 실행하는 경량 assert 스크립트를 둔다.

---

## 파일 구조 (생성/수정 대상)

**생성:**
- `lib/site-settings.ts` — 타입·기본값·파서·시간 포맷터·동아리 색상 프리셋·링크 fallback 상수 (순수 로직)
- `scripts/site-settings.test.mjs` — `lib/site-settings.ts` 순수 함수 assert (node 실행)
- `app/api/site-settings/route.ts` — SiteSettings GET/PUT
- `app/api/site-links/route.ts` — SiteLink GET/POST
- `app/api/site-links/[id]/route.ts` — SiteLink PUT/DELETE
- `app/api/clubs/route.ts` — Club GET/POST
- `app/api/clubs/[id]/route.ts` — Club PUT/DELETE
- `app/admin/(protected)/site/page.tsx` — 관리자 페이지 (인증 가드 + 에디터 렌더)
- `components/admin/SiteSettingsEditor.tsx` — 탭 셸 (운영시간·연락처 / 링크 / 동아리)
- `components/admin/site/HoursContactTab.tsx`
- `components/admin/site/LinksTab.tsx`
- `components/admin/site/ClubsTab.tsx`
- `scripts/seed-site-settings.mjs` — 현재 하드코딩 값 시드 (멱등)

**수정:**
- `prisma/schema.prisma` — 모델 3개 추가
- `app/admin/(protected)/page.tsx` — 대시보드 카드 1개 추가
- `app/page.tsx` — SiteSettings 조회 → HomeClient prop
- `components/home-client.tsx` — 운영시간 카드를 prop 기반으로
- `components/Footer.tsx` — 연락처·SNS를 fetch + fallback
- `app/members/page.tsx` — Club·SiteLink 조회 → MembersClient prop
- `app/members/members-client.tsx` — CLUBS 상수/lib import 제거, prop 사용

---

## Task 1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (파일 끝에 모델 추가)

- [ ] **Step 1: 스키마에 모델 3개 추가**

`prisma/schema.prisma` 맨 끝에 추가:

```prisma
// ── 사이트 설정 ──────────────────────────────────────────
// 싱글톤: 운영시간 + 연락처 (PopupSettings 패턴)
model SiteSettings {
  id         Int      @id @default(1)
  locationKo String   @default("N7동 학생회실")
  locationEn String   @default("Student Council Room, N7")
  email      String   @default("kaist.mesc@gmail.com")
  phone      String?
  hoursJson  String?
  updatedAt  DateTime @updatedAt
}

// 리스트: 외부링크·SNS (PopupLink 패턴 + category)
model SiteLink {
  id            Int      @id @default(autoincrement())
  category      String   @default("important") // "important" | "community"
  label         String
  labelEn       String?
  url           String
  description   String?
  descriptionEn String?
  icon          String?
  order         Int      @default(0)
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())

  @@index([category, order])
}

// 리스트: 동아리 (Member 패턴)
model Club {
  id           Int      @id @default(autoincrement())
  name         String
  nameEn       String?
  tagKo        String?
  tagEn        String?
  descKo       String
  descEn       String?
  activitiesKo String?
  activitiesEn String?
  url          String?
  urlLabel     String?
  emoji        String?
  colorPreset  String?
  order        Int      @default(0)
  enabled      Boolean  @default(true)
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 2: 마이그레이션 생성 (로컬 SQLite)**

Run: `npx prisma migrate dev --name add_site_settings`
Expected: `prisma/migrations/<timestamp>_add_site_settings/migration.sql` 생성, dev.db에 3개 테이블 적용, `Prisma Client` 재생성. 출력에 `Your database is now in sync`.

> 프로덕션(Turso)은 빌드 시 `prisma/libsql-migrate.mjs`가 이 새 폴더를 자동 적용한다(추가 작업 불필요).

- [ ] **Step 3: 마이그레이션 SQL이 커스텀 파서와 호환되는지 확인**

Run: `cat prisma/migrations/*_add_site_settings/migration.sql`
Expected: `CREATE TABLE "SiteSettings" ...`, `CREATE TABLE "SiteLink" ...`, `CREATE TABLE "Club" ...`, `CREATE INDEX ...`. 각 문장이 `;`로 끝남(libsql-migrate.mjs가 `;`로 분리하므로 정상).

- [ ] **Step 4: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (Prisma Client에 `siteSettings`, `siteLink`, `club` 모델 타입 생성됨).

- [ ] **Step 5: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): SiteSettings·SiteLink·Club 모델 추가"
```

---

## Task 2: `lib/site-settings.ts` — 순수 로직 모듈

**Files:**
- Create: `lib/site-settings.ts`
- Create: `scripts/site-settings.test.mjs`

- [ ] **Step 1: lib 작성**

Create `lib/site-settings.ts`:

```ts
// 사이트 설정 — 순수 타입/기본값/파서/포맷터 (DB·React 비의존)

// ── 운영시간 ──────────────────────────────────────────────
// day: 월=0 … 일=6
export interface DayHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  closed: boolean;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}
export interface OperatingHours {
  days: DayHours[];
  lunch: { open: string; close: string } | null;
}

export const WEEKDAY_LABELS: Record<"ko" | "en", string[]> = {
  ko: ["월", "화", "수", "목", "금", "토", "일"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  days: [
    { day: 0, closed: false, open: "09:00", close: "18:00" },
    { day: 1, closed: false, open: "09:00", close: "18:00" },
    { day: 2, closed: false, open: "09:00", close: "18:00" },
    { day: 3, closed: false, open: "09:00", close: "18:00" },
    { day: 4, closed: false, open: "09:00", close: "18:00" },
    { day: 5, closed: true, open: "09:00", close: "18:00" },
    { day: 6, closed: true, open: "09:00", close: "18:00" },
  ],
  lunch: { open: "12:00", close: "13:00" },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

/** JSON 문자열 → OperatingHours. 실패/누락 시 기본값. (parseGraph 패턴) */
export function parseHours(json: string | null | undefined): OperatingHours {
  if (!json) return DEFAULT_OPERATING_HOURS;
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data.days) || data.days.length !== 7) return DEFAULT_OPERATING_HOURS;
    const days: DayHours[] = data.days.map((d: Record<string, unknown>, i: number) => ({
      day: i as DayHours["day"],
      closed: Boolean(d.closed),
      open: isValidTime(d.open) ? (d.open as string) : "09:00",
      close: isValidTime(d.close) ? (d.close as string) : "18:00",
    }));
    const lunch =
      data.lunch && isValidTime(data.lunch.open) && isValidTime(data.lunch.close)
        ? { open: data.lunch.open as string, close: data.lunch.close as string }
        : null;
    return { days, lunch };
  } catch {
    return DEFAULT_OPERATING_HOURS;
  }
}

/** 평일(월~금) 표시 문자열. 모두 동일/영업 → "09:00 - 18:00", 모두 휴무 → null, 혼재 → 요일별 "월 09:00-18:00, …" */
export function formatWeekdayHours(h: OperatingHours, lang: "ko" | "en" = "ko"): string | null {
  const weekdays = h.days.filter((d) => d.day <= 4);
  const open = weekdays.filter((d) => !d.closed);
  if (open.length === 0) return null;
  const uniform =
    open.length === 5 &&
    open.every((d) => d.open === open[0].open && d.close === open[0].close);
  if (uniform) return `${open[0].open} - ${open[0].close}`;
  return open.map((d) => `${WEEKDAY_LABELS[lang][d.day]} ${d.open}-${d.close}`).join(", ");
}

/** 점심시간 표시 문자열 또는 null(미설정 시 행 숨김) */
export function formatLunch(h: OperatingHours): string | null {
  return h.lunch ? `${h.lunch.open} - ${h.lunch.close}` : null;
}

/** 주말(토·일) 모두 휴무인가 */
export function isWeekendClosed(h: OperatingHours): boolean {
  const weekend = h.days.filter((d) => d.day >= 5);
  return weekend.length > 0 && weekend.every((d) => d.closed);
}

/** 주말 영업 시 표시 문자열 (둘 중 하나라도 영업), 모두 휴무면 null */
export function formatWeekendHours(h: OperatingHours, lang: "ko" | "en" = "ko"): string | null {
  const weekend = h.days.filter((d) => d.day >= 5 && !d.closed);
  if (weekend.length === 0) return null;
  return weekend.map((d) => `${WEEKDAY_LABELS[lang][d.day]} ${d.open}-${d.close}`).join(", ");
}

// ── 동아리 색상 프리셋 ────────────────────────────────────
export const CLUB_COLOR_PRESETS: Record<string, string> = {
  blue: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
  orange: "from-orange-500/10 to-red-500/10 border-orange-500/20",
  green: "from-green-500/10 to-emerald-500/10 border-green-500/20",
  purple: "from-purple-500/10 to-pink-500/10 border-purple-500/20",
};
export const DEFAULT_CLUB_COLOR = CLUB_COLOR_PRESETS.blue;
export function getClubColor(preset: string | null | undefined): string {
  return (preset && CLUB_COLOR_PRESETS[preset]) || DEFAULT_CLUB_COLOR;
}

// ── 링크 카테고리 ─────────────────────────────────────────
export const LINK_CATEGORIES = ["important", "community"] as const;
export type LinkCategory = (typeof LINK_CATEGORIES)[number];
```

- [ ] **Step 2: 순수 함수 assert 테스트 작성**

Create `scripts/site-settings.test.mjs`:

```js
// node scripts/site-settings.test.mjs — 의존성 없는 순수 함수 검증
import assert from "node:assert/strict";
import {
  parseHours,
  formatWeekdayHours,
  formatLunch,
  isWeekendClosed,
  getClubColor,
  DEFAULT_OPERATING_HOURS,
  DEFAULT_CLUB_COLOR,
  CLUB_COLOR_PRESETS,
} from "../lib/site-settings.ts";

// parseHours: 잘못된 입력 → 기본값
assert.deepEqual(parseHours(null), DEFAULT_OPERATING_HOURS);
assert.deepEqual(parseHours("not json"), DEFAULT_OPERATING_HOURS);
assert.deepEqual(parseHours('{"days":[]}'), DEFAULT_OPERATING_HOURS);

// 기본값: 평일 09-18, 점심 12-13, 주말 휴무
const def = DEFAULT_OPERATING_HOURS;
assert.equal(formatWeekdayHours(def), "09:00 - 18:00");
assert.equal(formatLunch(def), "12:00 - 13:00");
assert.equal(isWeekendClosed(def), true);

// 평일 모두 휴무 → null
const allClosed = { days: def.days.map((d) => ({ ...d, closed: true })), lunch: null };
assert.equal(formatWeekdayHours(allClosed), null);
assert.equal(formatLunch(allClosed), null);

// 색상 프리셋
assert.equal(getClubColor("orange"), CLUB_COLOR_PRESETS.orange);
assert.equal(getClubColor("nonexistent"), DEFAULT_CLUB_COLOR);
assert.equal(getClubColor(null), DEFAULT_CLUB_COLOR);

console.log("✅ site-settings.test.mjs 통과");
```

- [ ] **Step 3: 테스트 실행 (실패 확인 → 통과 확인)**

Run: `node --experimental-strip-types scripts/site-settings.test.mjs`
Expected: `✅ site-settings.test.mjs 통과`

> Node 22+는 `--experimental-strip-types`로 `.ts` import 가능. 버전 문제로 실패하면 `node scripts/site-settings.test.mjs`(타입 제거 후)로 폴백하되, 우선 strip-types를 시도한다.

- [ ] **Step 4: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add lib/site-settings.ts scripts/site-settings.test.mjs
git commit -m "feat(lib): site-settings 타입·파서·포맷터·색상 프리셋 + 단위 검증"
```

---

## Task 3: API `/api/site-settings` (GET/PUT)

**Files:**
- Create: `app/api/site-settings/route.ts`

- [ ] **Step 1: 라우트 작성** (popup/route.ts 패턴)

Create `app/api/site-settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseHours, isValidTime, type OperatingHours } from "@/lib/site-settings";

// 공개: 운영시간 + 연락처
export async function GET() {
  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    locationKo: s?.locationKo ?? "N7동 학생회실",
    locationEn: s?.locationEn ?? "Student Council Room, N7",
    email: s?.email ?? "kaist.mesc@gmail.com",
    phone: s?.phone ?? null,
    hours: parseHours(s?.hoursJson),
  });
}

// 인증: 수정 (단일 행 upsert)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const locationKo = typeof body.locationKo === "string" ? body.locationKo.trim().slice(0, 100) : "";
  const locationEn = typeof body.locationEn === "string" ? body.locationEn.trim().slice(0, 100) || null : null;
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 100) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) || null : null;

  if (!locationKo) return NextResponse.json({ error: "위치(한국어)는 필수입니다." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });

  // 운영시간 검증
  const hours = body.hours as OperatingHours | undefined;
  if (!hours || !Array.isArray(hours.days) || hours.days.length !== 7)
    return NextResponse.json({ error: "운영시간 형식이 올바르지 않습니다." }, { status: 400 });
  for (const d of hours.days) {
    if (!d.closed && (!isValidTime(d.open) || !isValidTime(d.close)))
      return NextResponse.json({ error: "운영시간(HH:MM) 형식이 올바르지 않습니다." }, { status: 400 });
    if (!d.closed && d.open >= d.close)
      return NextResponse.json({ error: "종료 시간은 시작 시간보다 늦어야 합니다." }, { status: 400 });
  }
  if (hours.lunch && (!isValidTime(hours.lunch.open) || !isValidTime(hours.lunch.close)))
    return NextResponse.json({ error: "점심시간 형식이 올바르지 않습니다." }, { status: 400 });

  const hoursJson = JSON.stringify({
    days: hours.days.map((d, i) => ({
      day: i,
      closed: Boolean(d.closed),
      open: d.open,
      close: d.close,
    })),
    lunch: hours.lunch ?? null,
  });

  const data = { locationKo, locationEn, email: email || "kaist.mesc@gmail.com", phone, hoursJson };
  const saved = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return NextResponse.json({ ...saved, hours: parseHours(saved.hoursJson) });
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: GET 동작 수동 확인**

Run (별도 터미널에서 `npm run dev` 실행 중):
`curl -s localhost:3000/api/site-settings | head -c 400`
Expected: `{"locationKo":"N7동 학생회실",...,"hours":{"days":[...],"lunch":{...}}}` (DB 비어있어도 기본값 반환).

- [ ] **Step 4: 커밋**

```bash
git add app/api/site-settings/route.ts
git commit -m "feat(api): /api/site-settings GET/PUT (운영시간·연락처)"
```

---

## Task 4: API `/api/site-links` + `[id]`

**Files:**
- Create: `app/api/site-links/route.ts`
- Create: `app/api/site-links/[id]/route.ts`

- [ ] **Step 1: 목록/생성 라우트 작성** (popup/links 패턴)

Create `app/api/site-links/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl } from "@/lib/validation";
import { LINK_CATEGORIES } from "@/lib/site-settings";

// 공개: enabled 링크. ?category=important|community 로 필터, 없으면 전체.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const where: Record<string, unknown> = { enabled: true };
  if (category && LINK_CATEGORIES.includes(category as never)) where.category = category;
  const links = await prisma.siteLink.findMany({ where, orderBy: { order: "asc" } });
  return NextResponse.json(links);
}

// 인증: 신규 링크
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const category = LINK_CATEGORIES.includes(body.category) ? body.category : "important";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
  const labelEn = typeof body.labelEn === "string" ? body.labelEn.trim().slice(0, 60) || null : null;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 200) || null : null;
  const descriptionEn = typeof body.descriptionEn === "string" ? body.descriptionEn.trim().slice(0, 200) || null : null;
  const icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 20) || null : null;
  const order = typeof body.order === "number" ? body.order : 0;
  const enabled = body.enabled !== false;

  if (!label || !url) return NextResponse.json({ error: "라벨과 URL은 필수입니다." }, { status: 400 });
  if (!isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });

  const link = await prisma.siteLink.create({
    data: { category, label, labelEn, url, description, descriptionEn, icon, order, enabled },
  });
  return NextResponse.json(link, { status: 201 });
}
```

- [ ] **Step 2: 수정/삭제 라우트 작성**

Create `app/api/site-links/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl, parseId } from "@/lib/validation";
import { LINK_CATEGORIES } from "@/lib/site-settings";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (LINK_CATEGORIES.includes(body.category)) data.category = body.category;
  if (typeof body.label === "string") data.label = body.label.trim().slice(0, 60);
  if (typeof body.labelEn === "string") data.labelEn = body.labelEn.trim().slice(0, 60) || null;
  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (!isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    data.url = url;
  }
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 200) || null;
  if (typeof body.descriptionEn === "string") data.descriptionEn = body.descriptionEn.trim().slice(0, 200) || null;
  if (typeof body.icon === "string") data.icon = body.icon.trim().slice(0, 20) || null;
  if (typeof body.order === "number") data.order = body.order;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  const link = await prisma.siteLink.update({ where: { id }, data });
  return NextResponse.json(link);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  await prisma.siteLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add app/api/site-links
git commit -m "feat(api): /api/site-links CRUD"
```

---

## Task 5: API `/api/clubs` + `[id]`

**Files:**
- Create: `app/api/clubs/route.ts`
- Create: `app/api/clubs/[id]/route.ts`

- [ ] **Step 1: 목록/생성 라우트 작성**

Create `app/api/clubs/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl } from "@/lib/validation";

// 공개: enabled 동아리 (정렬)
export async function GET() {
  const clubs = await prisma.club.findMany({
    where: { enabled: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(clubs);
}

// 인증: 신규 동아리
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const descKo = typeof body.descKo === "string" ? body.descKo.trim().slice(0, 2000) : "";
  if (!name || !descKo) return NextResponse.json({ error: "이름과 설명(한국어)은 필수입니다." }, { status: 400 });

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url && !isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });

  const club = await prisma.club.create({
    data: {
      name,
      nameEn: typeof body.nameEn === "string" ? body.nameEn.trim().slice(0, 60) || null : null,
      tagKo: typeof body.tagKo === "string" ? body.tagKo.trim().slice(0, 40) || null : null,
      tagEn: typeof body.tagEn === "string" ? body.tagEn.trim().slice(0, 40) || null : null,
      descKo,
      descEn: typeof body.descEn === "string" ? body.descEn.trim().slice(0, 2000) || null : null,
      activitiesKo: typeof body.activitiesKo === "string" ? body.activitiesKo.trim().slice(0, 2000) || null : null,
      activitiesEn: typeof body.activitiesEn === "string" ? body.activitiesEn.trim().slice(0, 2000) || null : null,
      url: url || null,
      urlLabel: typeof body.urlLabel === "string" ? body.urlLabel.trim().slice(0, 20) || null : null,
      emoji: typeof body.emoji === "string" ? body.emoji.trim().slice(0, 10) || null : null,
      colorPreset: typeof body.colorPreset === "string" ? body.colorPreset.trim().slice(0, 20) || null : null,
      order: typeof body.order === "number" ? body.order : 0,
      enabled: body.enabled !== false,
    },
  });
  return NextResponse.json(club, { status: 201 });
}
```

- [ ] **Step 2: 수정/삭제 라우트 작성**

Create `app/api/clubs/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl, parseId } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
  if (typeof body.nameEn === "string") data.nameEn = body.nameEn.trim().slice(0, 60) || null;
  if (typeof body.tagKo === "string") data.tagKo = body.tagKo.trim().slice(0, 40) || null;
  if (typeof body.tagEn === "string") data.tagEn = body.tagEn.trim().slice(0, 40) || null;
  if (typeof body.descKo === "string") data.descKo = body.descKo.trim().slice(0, 2000);
  if (typeof body.descEn === "string") data.descEn = body.descEn.trim().slice(0, 2000) || null;
  if (typeof body.activitiesKo === "string") data.activitiesKo = body.activitiesKo.trim().slice(0, 2000) || null;
  if (typeof body.activitiesEn === "string") data.activitiesEn = body.activitiesEn.trim().slice(0, 2000) || null;
  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (url && !isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    data.url = url || null;
  }
  if (typeof body.urlLabel === "string") data.urlLabel = body.urlLabel.trim().slice(0, 20) || null;
  if (typeof body.emoji === "string") data.emoji = body.emoji.trim().slice(0, 10) || null;
  if (typeof body.colorPreset === "string") data.colorPreset = body.colorPreset.trim().slice(0, 20) || null;
  if (typeof body.order === "number") data.order = body.order;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  const club = await prisma.club.update({ where: { id }, data });
  return NextResponse.json(club);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  await prisma.club.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 타입 확인 + 커밋**

Run: `npx tsc --noEmit`  → 에러 없음.

```bash
git add app/api/clubs
git commit -m "feat(api): /api/clubs CRUD"
```

---

## Task 6: 시드 스크립트 (현재 하드코딩 값 → DB)

**Files:**
- Create: `scripts/seed-site-settings.mjs`

- [ ] **Step 1: 시드 스크립트 작성** (seed-rooms.mjs 패턴, 멱등)

Create `scripts/seed-site-settings.mjs`:

```js
// 현재 하드코딩된 사이트 콘텐츠를 DB에 시드한다 (멱등).
// SiteSettings: id=1 upsert. SiteLink/Club: 비어있을 때만 시드.
// 사용: node scripts/seed-site-settings.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter });

const HOURS = {
  days: [
    { day: 0, closed: false, open: "09:00", close: "18:00" },
    { day: 1, closed: false, open: "09:00", close: "18:00" },
    { day: 2, closed: false, open: "09:00", close: "18:00" },
    { day: 3, closed: false, open: "09:00", close: "18:00" },
    { day: 4, closed: false, open: "09:00", close: "18:00" },
    { day: 5, closed: true, open: "09:00", close: "18:00" },
    { day: 6, closed: true, open: "09:00", close: "18:00" },
  ],
  lunch: { open: "12:00", close: "13:00" },
};

const LINKS = [
  { category: "important", label: "기계공학과 홈페이지", labelEn: "ME Department Website", url: "https://me.kaist.ac.kr/", description: "학과 공식 홈페이지", descriptionEn: "Official department website", icon: "🏫", order: 0 },
  { category: "important", label: "KAIST 포털", labelEn: "KAIST Portal", url: "https://portal.kaist.ac.kr/", description: "수강신청, 성적 확인 등", descriptionEn: "Course registration, grades, etc.", icon: "🎓", order: 1 },
  { category: "important", label: "기계공학과 회칙", labelEn: "ME Council Bylaws", url: "https://drive.google.com/file/d/1uwPFQuggxrbsZsOVY-mAhFY0KKGyWawk/view?usp=sharing", description: "기계공학과 학생회 회칙 문서", descriptionEn: "ME Student Council bylaws document", icon: "📜", order: 2 },
  { category: "community", label: "카카오톡 채널", labelEn: "KakaoTalk Channel", url: "http://pf.kakao.com/_fHXxkn/chat", description: "학생회 공지 채널", descriptionEn: "Student council announcement channel", icon: "💬", order: 0 },
  { category: "community", label: "네이버 카페 (학습자료)", labelEn: "Naver Cafe (Resources)", url: "https://cafe.naver.com/kaistme", description: "강의자료, 시험족보 등", descriptionEn: "Lecture materials, past exams, etc.", icon: "📚", order: 1 },
  { category: "community", label: "인스타그램 (학생회)", labelEn: "Instagram (Council)", url: "https://www.instagram.com/i_love_mesc/", description: "학생회 활동 소식", descriptionEn: "Student council activities", icon: "📸", order: 2 },
  { category: "community", label: "인스타그램 (학과)", labelEn: "Instagram (Department)", url: "https://www.instagram.com/kaist_me/", description: "기계공학과 공식 인스타그램", descriptionEn: "Official ME department Instagram", icon: "🔬", order: 3 },
];

const CLUBS = [
  {
    name: "MR", nameEn: "MR (Microrobot Research)", tagKo: "로봇 연구", tagEn: "Robotics Research",
    descKo: "KAIST 유일의 로봇 동아리로, 다양한 종류의 로봇을 직접 설계하고 제작하며 연구합니다. 전공과 관계없이 로봇에 관심 있는 누구나 참여할 수 있으며, 3D 프린터·각종 공구 등 풍부한 장비를 갖춘 동아리방에서 활동합니다. 제작한 로봇으로 대회 참가와 방송 출연 등 활발한 대외 활동을 이어가고 있습니다.",
    descEn: "MR (Microrobot Research) is KAIST's only robot club, where members design, build, and research all kinds of robots. Open to all students regardless of major, the club provides foundational robotics education and access to 3D printers and various tools. Members actively participate in robot competitions and media appearances.",
    activitiesKo: ["로봇 설계 및 제작 프로젝트", "신입부원 기초 교육 (아두이노, 회로설계)", "대회 참가 및 방송 출연", "자체 학생 로봇 대회 운영"].join("\n"),
    activitiesEn: ["Robot design & fabrication projects", "Foundational education (Arduino, circuit design)", "Competition participation & media appearances", "Student robotics competition hosting"].join("\n"),
    url: "https://mr.kaist.ac.kr/", urlLabel: "site", emoji: "🤖", colorPreset: "blue", order: 0,
  },
  {
    name: "질주", nameEn: "ZILZU", tagKo: "자작자동차", tagEn: "Built-Car Racing",
    descKo: "1998년 창설된 KAIST 기계공학과 자작자동차 동아리입니다. 엔진·타이어 등 완제품을 제외한 설계, 용접, 프레임, 전기 배선까지 오프로드 경주용 자동차를 처음부터 끝까지 직접 제작합니다. 매년 KSAE 대학생 자작자동차 대회(C-Baja / E-Baja)에 참가하며 실전 엔지니어링 경험을 쌓습니다.",
    descEn: "ZILZU is KAIST's student-built automobile club under the Department of Mechanical Engineering, founded in 1998. Members independently design and fabricate off-road racing vehicles from scratch — handling everything from frame welding and suspension to electrical wiring. The team competes annually in the KSAE Student Built-Car Competition in both C-Baja and E-Baja categories.",
    activitiesKo: ["오프로드 경주용 자동차 설계·제작 (CAD, 정적/유동해석)", "KSAE 대학생 자작자동차 대회 참가", "C-Baja (내연기관) · E-Baja (전기차) 부문 출전", "설계부터 용접·전기 배선까지 전 과정 직접 수행"].join("\n"),
    activitiesEn: ["Off-road vehicle design & fabrication (CAD, FEA)", "KSAE Student Built-Car Competition", "C-Baja (combustion) & E-Baja (electric) categories", "Full in-house production: welding, wiring & more"].join("\n"),
    url: "https://www.instagram.com/kaist_zilzu/?hl=ko", urlLabel: "insta", emoji: "🏎️", colorPreset: "orange", order: 1,
  },
];

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      locationKo: "N7동 학생회실",
      locationEn: "Student Council Room, N7",
      email: "kaist.mesc@gmail.com",
      phone: null,
      hoursJson: JSON.stringify(HOURS),
    },
  });
  console.log("[seed] SiteSettings upsert 완료");

  const linkCount = await prisma.siteLink.count();
  if (linkCount === 0) {
    await prisma.siteLink.createMany({ data: LINKS });
    console.log(`[seed] SiteLink ${LINKS.length}개 생성`);
  } else {
    console.log(`[seed] SiteLink 이미 ${linkCount}개 존재 — 스킵`);
  }

  const clubCount = await prisma.club.count();
  if (clubCount === 0) {
    await prisma.club.createMany({ data: CLUBS });
    console.log(`[seed] Club ${CLUBS.length}개 생성`);
  } else {
    console.log(`[seed] Club 이미 ${clubCount}개 존재 — 스킵`);
  }

  console.log("[seed] 완료");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: 시드 실행 (로컬)**

Run: `node scripts/seed-site-settings.mjs`
Expected: `[seed] SiteSettings upsert 완료`, `[seed] SiteLink 7개 생성`, `[seed] Club 2개 생성`, `[seed] 완료`.

- [ ] **Step 3: 멱등성 확인 (재실행)**

Run: `node scripts/seed-site-settings.mjs`
Expected: `SiteLink 이미 7개 존재 — 스킵`, `Club 이미 2개 존재 — 스킵`. (중복 생성 안 됨)

- [ ] **Step 4: 데이터 확인**

Run: `curl -s "localhost:3000/api/site-links?category=community" | head -c 300`
Expected: 카카오톡/네이버카페/인스타 링크 JSON 배열.

- [ ] **Step 5: 커밋**

```bash
git add scripts/seed-site-settings.mjs
git commit -m "feat(seed): 현재 하드코딩 사이트 콘텐츠 DB 시드 (멱등)"
```

---

## Task 7: 관리자 페이지 + 대시보드 카드 + 에디터 셸

**Files:**
- Modify: `app/admin/(protected)/page.tsx`
- Create: `app/admin/(protected)/site/page.tsx`
- Create: `components/admin/SiteSettingsEditor.tsx`

- [ ] **Step 1: 대시보드 카드 추가**

`app/admin/(protected)/page.tsx`의 import 라인(6번째 줄)에서 lucide 아이콘에 `Wrench` 추가 — 기존 `import { Settings, Bell, ... , MessageSquare } from "lucide-react";`를 다음으로 교체(끝에 `Wrench` 추가):

```ts
import { Settings, Bell, BookOpen, Users, Home, ExternalLink, ShieldCheck, LogOut, GraduationCap, Camera, Cookie, Megaphone, Building2, UserSquare, MessageSquare, Wrench } from "lucide-react";
```

그리고 `links` 배열에서 커뮤니티 모더레이션 항목(`href: "/admin/community"` 객체) **다음**, 배열 닫는 `];` **앞**에 추가:

```ts
    {
      href: "/admin/site",
      label: "사이트 설정",
      icon: Wrench,
      desc: "운영시간·연락처·외부링크·동아리 관리",
      color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    },
```

- [ ] **Step 2: 관리자 페이지 라우트 작성**

Create `app/admin/(protected)/site/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SiteSettingsEditor from "@/components/admin/SiteSettingsEditor";
import { parseHours } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminSitePage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const links = await prisma.siteLink.findMany({ orderBy: { order: "asc" } });
  const clubs = await prisma.club.findMany({ orderBy: { order: "asc" } });

  const settings = {
    locationKo: s?.locationKo ?? "N7동 학생회실",
    locationEn: s?.locationEn ?? "Student Council Room, N7",
    email: s?.email ?? "kaist.mesc@gmail.com",
    phone: s?.phone ?? "",
    hours: parseHours(s?.hoursJson),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
            대시보드
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-black text-lg">사이트 설정</h1>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <SiteSettingsEditor initialSettings={settings} initialLinks={links} initialClubs={clubs} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 에디터 셸 작성 (탭 3개)**

Create `components/admin/SiteSettingsEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HoursContactTab from "@/components/admin/site/HoursContactTab";
import LinksTab from "@/components/admin/site/LinksTab";
import ClubsTab from "@/components/admin/site/ClubsTab";
import type { OperatingHours } from "@/lib/site-settings";

export interface SiteSettingsData {
  locationKo: string;
  locationEn: string;
  email: string;
  phone: string;
  hours: OperatingHours;
}
export interface SiteLinkRow {
  id: number;
  category: string;
  label: string;
  labelEn: string | null;
  url: string;
  description: string | null;
  descriptionEn: string | null;
  icon: string | null;
  order: number;
  enabled: boolean;
}
export interface ClubRow {
  id: number;
  name: string;
  nameEn: string | null;
  tagKo: string | null;
  tagEn: string | null;
  descKo: string;
  descEn: string | null;
  activitiesKo: string | null;
  activitiesEn: string | null;
  url: string | null;
  urlLabel: string | null;
  emoji: string | null;
  colorPreset: string | null;
  order: number;
  enabled: boolean;
}

export default function SiteSettingsEditor({
  initialSettings,
  initialLinks,
  initialClubs,
}: {
  initialSettings: SiteSettingsData;
  initialLinks: SiteLinkRow[];
  initialClubs: ClubRow[];
}) {
  const [tab, setTab] = useState("hours");
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="hours">운영시간·연락처</TabsTrigger>
        <TabsTrigger value="links">링크</TabsTrigger>
        <TabsTrigger value="clubs">동아리</TabsTrigger>
      </TabsList>
      <TabsContent value="hours">
        <HoursContactTab initial={initialSettings} />
      </TabsContent>
      <TabsContent value="links">
        <LinksTab initial={initialLinks} />
      </TabsContent>
      <TabsContent value="clubs">
        <ClubsTab initial={initialClubs} />
      </TabsContent>
    </Tabs>
  );
}
```

> 이 시점에 하위 탭 컴포넌트(Task 8–10)가 아직 없으므로 tsc는 import 에러를 낸다. Task 10까지 마친 뒤 한 번에 타입 확인한다. 우선 여기까지 커밋하지 않고 Task 8로 진행한다.

---

## Task 8: 운영시간·연락처 탭

**Files:**
- Create: `components/admin/site/HoursContactTab.tsx`

- [ ] **Step 1: 컴포넌트 작성**

Create `components/admin/site/HoursContactTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { WEEKDAY_LABELS, type OperatingHours } from "@/lib/site-settings";
import type { SiteSettingsData } from "@/components/admin/SiteSettingsEditor";

export default function HoursContactTab({ initial }: { initial: SiteSettingsData }) {
  const [locationKo, setLocationKo] = useState(initial.locationKo);
  const [locationEn, setLocationEn] = useState(initial.locationEn);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [hours, setHours] = useState<OperatingHours>(initial.hours);
  const [lunchEnabled, setLunchEnabled] = useState(initial.hours.lunch !== null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setDay(idx: number, patch: Partial<OperatingHours["days"][number]>) {
    setHours((h) => ({ ...h, days: h.days.map((d, i) => (i === idx ? { ...d, ...patch } : d)) }));
  }
  function setLunch(patch: Partial<NonNullable<OperatingHours["lunch"]>>) {
    setHours((h) => ({ ...h, lunch: { ...(h.lunch ?? { open: "12:00", close: "13:00" }), ...patch } }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        locationKo, locationEn, email, phone,
        hours: { ...hours, lunch: lunchEnabled ? (hours.lunch ?? { open: "12:00", close: "13:00" }) : null },
      };
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "저장 실패");
      }
      setMsg("저장되었습니다.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">연락처·위치</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2"><Label>위치 (한국어)</Label><Input value={locationKo} onChange={(e) => setLocationKo(e.target.value)} /></div>
          <div className="grid gap-2"><Label>위치 (English)</Label><Input value={locationEn} onChange={(e) => setLocationEn(e.target.value)} /></div>
          <div className="grid gap-2"><Label>이메일</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid gap-2"><Label>전화번호 (선택)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">운영시간</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {hours.days.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-8 font-bold">{WEEKDAY_LABELS.ko[i]}</span>
              <label className="flex items-center gap-1 text-sm">
                <Checkbox checked={d.closed} onCheckedChange={(c) => setDay(i, { closed: Boolean(c) })} />
                휴무
              </label>
              <Input type="time" value={d.open} disabled={d.closed} onChange={(e) => setDay(i, { open: e.target.value })} className="w-32" />
              <span>~</span>
              <Input type="time" value={d.close} disabled={d.closed} onChange={(e) => setDay(i, { close: e.target.value })} className="w-32" />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-border/40">
            <label className="flex items-center gap-1 text-sm w-20">
              <Checkbox checked={lunchEnabled} onCheckedChange={(c) => setLunchEnabled(Boolean(c))} />
              점심시간
            </label>
            <Input type="time" value={hours.lunch?.open ?? "12:00"} disabled={!lunchEnabled} onChange={(e) => setLunch({ open: e.target.value })} className="w-32" />
            <span>~</span>
            <Input type="time" value={hours.lunch?.close ?? "13:00"} disabled={!lunchEnabled} onChange={(e) => setLunch({ close: e.target.value })} className="w-32" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 다음 탭으로 진행** (타입 확인은 Task 10 이후 일괄)

> 셸/탭이 서로를 import하므로 개별 tsc는 미완 상태. Task 9로 진행.

---

## Task 9: 링크 탭

**Files:**
- Create: `components/admin/site/LinksTab.tsx`

- [ ] **Step 1: 컴포넌트 작성**

Create `components/admin/site/LinksTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import type { SiteLinkRow } from "@/components/admin/SiteSettingsEditor";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "important", label: "주요 링크" },
  { key: "community", label: "SNS·커뮤니티" },
];

export default function LinksTab({ initial }: { initial: SiteLinkRow[] }) {
  const [links, setLinks] = useState<SiteLinkRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch(id: number, p: Partial<SiteLinkRow>) {
    setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }

  async function add(category: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/site-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label: "새 링크", url: "https://", order: links.filter((l) => l.category === category).length }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      const created: SiteLinkRow = await res.json();
      setLinks((ls) => [...ls, created]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function saveOne(l: SiteLinkRow) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/site-links/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(l),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      setMsg("저장됨");
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("이 링크를 삭제할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/site-links/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setLinks((ls) => ls.filter((l) => l.id !== id));
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black">{cat.label}</h3>
            <Button size="sm" variant="outline" onClick={() => add(cat.key)} disabled={busy}>
              <Plus className="h-4 w-4 mr-1" /> 추가
            </Button>
          </div>
          {links.filter((l) => l.category === cat.key).map((l) => (
            <Card key={l.id}>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>라벨 (KO)</Label><Input value={l.label} onChange={(e) => patch(l.id, { label: e.target.value })} /></div>
                  <div className="grid gap-1"><Label>라벨 (EN)</Label><Input value={l.labelEn ?? ""} onChange={(e) => patch(l.id, { labelEn: e.target.value })} /></div>
                </div>
                <div className="grid gap-1"><Label>URL</Label><Input value={l.url} onChange={(e) => patch(l.id, { url: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>설명 (KO)</Label><Input value={l.description ?? ""} onChange={(e) => patch(l.id, { description: e.target.value })} /></div>
                  <div className="grid gap-1"><Label>설명 (EN)</Label><Input value={l.descriptionEn ?? ""} onChange={(e) => patch(l.id, { descriptionEn: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid gap-1 w-24"><Label>아이콘</Label><Input value={l.icon ?? ""} onChange={(e) => patch(l.id, { icon: e.target.value })} placeholder="🔗" /></div>
                  <div className="grid gap-1 w-24"><Label>순서</Label><Input type="number" value={l.order} onChange={(e) => patch(l.id, { order: Number(e.target.value) })} /></div>
                  <label className="flex items-center gap-1 text-sm mt-5"><input type="checkbox" checked={l.enabled} onChange={(e) => patch(l.id, { enabled: e.target.checked })} /> 노출</label>
                  <div className="ml-auto flex gap-2 mt-5">
                    <Button size="sm" onClick={() => saveOne(l)} disabled={busy}>저장</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 다음 탭으로 진행**

---

## Task 10: 동아리 탭

**Files:**
- Create: `components/admin/site/ClubsTab.tsx`

- [ ] **Step 1: 컴포넌트 작성**

Create `components/admin/site/ClubsTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { CLUB_COLOR_PRESETS } from "@/lib/site-settings";
import type { ClubRow } from "@/components/admin/SiteSettingsEditor";

const COLOR_KEYS = Object.keys(CLUB_COLOR_PRESETS);

export default function ClubsTab({ initial }: { initial: ClubRow[] }) {
  const [clubs, setClubs] = useState<ClubRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch(id: number, p: Partial<ClubRow>) {
    setClubs((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function add() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "새 동아리", descKo: "설명을 입력하세요", colorPreset: "blue", order: clubs.length }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      setClubs((cs) => [...cs, await res.json()]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function saveOne(c: ClubRow) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/clubs/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      setMsg("저장됨");
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("이 동아리를 삭제할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clubs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setClubs((cs) => cs.filter((c) => c.id !== id));
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={add} disabled={busy}><Plus className="h-4 w-4 mr-1" /> 동아리 추가</Button>
      </div>
      {clubs.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>이름 (KO)</Label><Input value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} /></div>
              <div className="grid gap-1"><Label>이름 (EN)</Label><Input value={c.nameEn ?? ""} onChange={(e) => patch(c.id, { nameEn: e.target.value })} /></div>
              <div className="grid gap-1"><Label>태그 (KO)</Label><Input value={c.tagKo ?? ""} onChange={(e) => patch(c.id, { tagKo: e.target.value })} /></div>
              <div className="grid gap-1"><Label>태그 (EN)</Label><Input value={c.tagEn ?? ""} onChange={(e) => patch(c.id, { tagEn: e.target.value })} /></div>
            </div>
            <div className="grid gap-1"><Label>설명 (KO)</Label><Textarea rows={3} value={c.descKo} onChange={(e) => patch(c.id, { descKo: e.target.value })} /></div>
            <div className="grid gap-1"><Label>설명 (EN)</Label><Textarea rows={3} value={c.descEn ?? ""} onChange={(e) => patch(c.id, { descEn: e.target.value })} /></div>
            <div className="grid gap-1"><Label>활동 (KO, 한 줄에 하나)</Label><Textarea rows={4} value={c.activitiesKo ?? ""} onChange={(e) => patch(c.id, { activitiesKo: e.target.value })} /></div>
            <div className="grid gap-1"><Label>활동 (EN, 한 줄에 하나)</Label><Textarea rows={4} value={c.activitiesEn ?? ""} onChange={(e) => patch(c.id, { activitiesEn: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>링크 URL</Label><Input value={c.url ?? ""} onChange={(e) => patch(c.id, { url: e.target.value })} /></div>
              <div className="grid gap-1"><Label>링크 라벨</Label><Input value={c.urlLabel ?? ""} onChange={(e) => patch(c.id, { urlLabel: e.target.value })} placeholder="site / insta" /></div>
              <div className="grid gap-1"><Label>이모지</Label><Input value={c.emoji ?? ""} onChange={(e) => patch(c.id, { emoji: e.target.value })} placeholder="🤖" /></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid gap-1"><Label>색상</Label>
                <select className="border border-border rounded-md h-9 px-2 bg-background text-sm" value={c.colorPreset ?? "blue"} onChange={(e) => patch(c.id, { colorPreset: e.target.value })}>
                  {COLOR_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="grid gap-1 w-20"><Label>순서</Label><Input type="number" value={c.order} onChange={(e) => patch(c.id, { order: Number(e.target.value) })} /></div>
              <label className="flex items-center gap-1 text-sm mt-5"><input type="checkbox" checked={c.enabled} onChange={(e) => patch(c.id, { enabled: e.target.checked })} /> 노출</label>
              <div className="ml-auto flex gap-2 mt-5">
                <Button size="sm" onClick={() => saveOne(c)} disabled={busy}>저장</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: shadcn 컴포넌트 존재 확인**

Run: `ls components/ui/textarea.tsx components/ui/checkbox.tsx components/ui/label.tsx components/ui/tabs.tsx components/ui/input.tsx`
Expected: 모두 존재. 없는 게 있으면 `npx shadcn@latest add <name>`로 추가.

- [ ] **Step 3: 타입 확인 (Task 7–10 일괄)**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 관리자 UI 수동 확인**

`npm run dev` 후 `/admin/login` 로그인 → `/admin/site` 접속.
Expected: 탭 3개. 운영시간 탭에 월~일 7행 + 점심행(기본값 채워짐), 연락처 4필드. 링크 탭에 주요 3개·SNS 4개. 동아리 탭에 MR·질주 2개. 한 항목 저장 시 "저장됨" 표시.

- [ ] **Step 5: 커밋**

```bash
git add "app/admin/(protected)/page.tsx" "app/admin/(protected)/site" components/admin/SiteSettingsEditor.tsx components/admin/site
git commit -m "feat(admin): /admin/site 사이트 설정 편집 UI (운영시간·링크·동아리 탭)"
```

---

## Task 11: 홈 운영시간 — DB 연결

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/home-client.tsx`

- [ ] **Step 1: 서버 페이지에서 SiteSettings 조회 → prop 전달**

`app/page.tsx`를 다음으로 교체:

```tsx
import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/home-client";
import { parseHours } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getRecentNotices() {
  return prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
}

export default async function HomePage() {
  const notices = await getRecentNotices();
  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const hours = parseHours(s?.hoursJson);

  return <HomeClient notices={notices} hours={hours} />;
}
```

- [ ] **Step 2: HomeClient prop 시그니처 확장**

`components/home-client.tsx` 상단 import에 추가:

```tsx
import {
  formatWeekdayHours,
  formatLunch,
  isWeekendClosed,
  formatWeekendHours,
  DEFAULT_OPERATING_HOURS,
  type OperatingHours,
} from "@/lib/site-settings";
```
> (`parseHours`는 서버 `app/page.tsx`에서만 호출하고 home-client에서는 import하지 않는다 — 미사용 import lint 에러 방지.)

`HomeClient` 컴포넌트 함수 시그니처(현재 `notices` prop 받는 곳)를 찾아 `hours`를 옵셔널로 추가. 예: 기존이
```tsx
export function HomeClient({ notices }: { notices: Notice[] }) {
```
라면 다음으로 교체(기존 `Notice` 타입 정의는 유지):
```tsx
export function HomeClient({ notices, hours }: { notices: Notice[]; hours?: OperatingHours }) {
  const oh: OperatingHours = hours ?? DEFAULT_OPERATING_HOURS;
  const weekdayHours = formatWeekdayHours(oh, "ko");
  const lunchHours = formatLunch(oh);
  const weekendClosed = isWeekendClosed(oh);
  const weekendHours = formatWeekendHours(oh, "ko");
```
> `lang`별 표시는 home-client가 `useLanguage`를 쓰면 그 `lang`을 formatter에 넘긴다. 현재 home-client가 client 컴포넌트이고 `t()`를 쓰므로 `lang`을 사용 가능. lang 사용이 가능하면 `"ko"` 대신 `lang`을 전달하도록 바꾼다(없으면 `"ko"` 유지).

- [ ] **Step 3: 운영시간 카드 마크업 교체**

`components/home-client.tsx`의 Operating Hours 카드 안 `<CardContent className="space-y-2 text-sm">` 블록(평일/점심/주말 3개 div) 전체를 다음으로 교체:

```tsx
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 px-2 rounded hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground font-bold">{t("home.weekday")}</span>
                  <span className="font-bold text-foreground">{weekdayHours ?? t("home.closed")}</span>
                </div>
                {lunchHours && (
                  <div className="flex justify-between items-center py-2 px-2 rounded hover:bg-muted/40 transition-colors">
                    <span className="text-muted-foreground font-bold">{t("home.lunchTime")}</span>
                    <span className="font-bold text-foreground">{lunchHours}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 px-2 rounded hover:bg-red-500/5 transition-colors">
                  <span className="text-muted-foreground font-bold">{t("home.weekend")}</span>
                  <span className={weekendClosed ? "font-bold text-red-600 dark:text-red-400" : "font-bold text-foreground"}>
                    {weekendClosed ? t("home.closed") : weekendHours}
                  </span>
                </div>
              </CardContent>
```

- [ ] **Step 4: 타입 확인 + 시각 확인**

Run: `npx tsc --noEmit` → 에러 없음.
`npm run dev` → 홈 운영시간 카드가 평일 09:00-18:00 / 점심 12:00-13:00 / 주말 휴무(빨강)로 **기존과 동일**하게 표시.

- [ ] **Step 5: 커밋**

```bash
git add app/page.tsx components/home-client.tsx
git commit -m "feat(home): 운영시간 카드를 SiteSettings(DB)에서 표시"
```

---

## Task 12: Footer 연락처·SNS — DB 연결 (fetch + fallback)

**Files:**
- Modify: `components/Footer.tsx`

- [ ] **Step 1: fallback 상수 + 상태 + fetch 추가**

`components/Footer.tsx` 상단(`export default function Footer()` 직전)에 fallback 상수 추가:

```tsx
const FALLBACK_CONTACT = { locationKo: "N7동 학생회실", locationEn: "Student Council Room, N7", email: "kaist.mesc@gmail.com" };
type SnsLink = { label: string; labelEn: string | null; url: string; icon: string | null };
const FALLBACK_SNS: SnsLink[] = [
  { label: "카카오톡 채널", labelEn: "KakaoTalk", url: "http://pf.kakao.com/_fHXxkn/chat", icon: "💬" },
  { label: "인스타그램 (학생회)", labelEn: "Instagram (Council)", url: "https://www.instagram.com/i_love_mesc/", icon: "📸" },
  { label: "네이버 카페", labelEn: "Naver Cafe", url: "https://cafe.naver.com/kaistme", icon: "📚" },
];
```

`Footer()` 본문 상단(`const { t, lang } = useLanguage();` 다음)에 추가:

```tsx
  const [contact, setContact] = useState(FALLBACK_CONTACT);
  const [sns, setSns] = useState<SnsLink[]>(FALLBACK_SNS);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((d) => setContact({ locationKo: d.locationKo, locationEn: d.locationEn, email: d.email }))
      .catch(() => {});
    fetch("/api/site-links?category=community")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length) setSns(d); })
      .catch(() => {});
  }, []);
```

import 라인에 `useState, useEffect` 추가:
```tsx
import { useState, useEffect } from "react";
```
(파일 최상단이 `"use client";`이므로 hook 사용 가능)

- [ ] **Step 2: contactInfo / snsLinks를 상태 기반으로 교체**

기존 `const contactInfo = [...]`를 다음으로 교체:

```tsx
  const contactInfo = [
    { icon: MapPin, label: lang === "ko" ? contact.locationKo : contact.locationEn, href: null },
    { icon: Mail, label: contact.email, href: `mailto:${contact.email}` },
  ];
```

기존 `const snsLinks = [...]` 정의를 찾아 다음으로 교체(렌더링에서 `snsLinks`를 쓰는 부분은 그대로 두되, 각 항목이 `{ label, labelEn, url, icon }` 형태가 되도록 렌더링 코드의 필드 접근을 확인):

```tsx
  const snsLinks = sns.map((s) => ({
    label: lang === "ko" ? s.label : s.labelEn || s.label,
    href: s.url,
    icon: s.icon,
  }));
```

> 주의: 기존 snsLinks 렌더링이 lucide 아이콘 컴포넌트를 기대했다면, 이제 icon은 이모지 문자열이다. 렌더 부분에서 아이콘 출력이 `<Icon />` 형태였다면 `{s.icon}` 텍스트 출력으로 바꾼다. 렌더링 코드를 읽고 필드명(`label`/`href`)이 맞는지 확인 후 조정한다.

- [ ] **Step 3: 타입 확인 + 시각 확인**

Run: `npx tsc --noEmit` → 에러 없음.
`npm run dev` → Footer 연락처(N7동 학생회실, 이메일)와 SNS 링크가 기존과 동일하게 보임(초기 fallback → fetch 후 동일 값).

- [ ] **Step 4: 커밋**

```bash
git add components/Footer.tsx
git commit -m "feat(footer): 연락처·SNS를 SiteSettings/SiteLink(DB)에서 표시 (fallback 유지)"
```

---

## Task 13: members 페이지 — 동아리·링크 DB 연결

**Files:**
- Modify: `app/members/page.tsx`
- Modify: `app/members/members-client.tsx`

- [ ] **Step 1: 서버 페이지에서 Club·SiteLink 조회**

`app/members/page.tsx`를 다음으로 교체:

```tsx
import { prisma } from "@/lib/prisma";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await prisma.member.findMany({ orderBy: [{ order: "asc" }] });
  const clubRows = await prisma.club.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
  const importantLinks = await prisma.siteLink.findMany({ where: { enabled: true, category: "important" }, orderBy: { order: "asc" } });
  const communityLinks = await prisma.siteLink.findMany({ where: { enabled: true, category: "community" }, orderBy: { order: "asc" } });

  const clubs = clubRows.map((c) => ({
    name: c.name,
    nameEn: c.nameEn ?? c.name,
    tagKo: c.tagKo ?? "",
    tagEn: c.tagEn ?? "",
    descKo: c.descKo,
    descEn: c.descEn ?? "",
    activitiesKo: (c.activitiesKo ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    activitiesEn: (c.activitiesEn ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    url: c.url ?? "",
    urlLabel: (c.urlLabel === "insta" ? "insta" : "site") as "site" | "insta",
    emoji: c.emoji ?? "",
    colorPreset: c.colorPreset ?? "blue",
  }));

  return <MembersClient members={members} clubs={clubs} importantLinks={importantLinks} communityLinks={communityLinks} />;
}
```

- [ ] **Step 2: members-client prop 시그니처 + 타입 변경**

`app/members/members-client.tsx`:

(a) 상단 import에서 `lib/links` import 제거하고 색상 헬퍼 추가:
```tsx
// 삭제: import { IMPORTANT_LINKS, COMMUNITY_LINKS } from "@/lib/links";
import { getClubColor } from "@/lib/site-settings";
```

(b) 기존 `interface Club { ... color: string ... }`에서 `color: string;`를 `colorPreset: string;`로 변경. `emoji: string;`는 유지.

(c) 기존 `const CLUBS: Club[] = [ ... ];` 전체(MR·질주 배열)를 **삭제**.

(d) `MembersClient` 함수 시그니처와 props 타입을 다음으로 변경(기존 members 타입은 유지):
```tsx
interface LinkRow { id: number; label: string; labelEn: string | null; url: string; description: string | null; descriptionEn: string | null; icon: string | null; }
export function MembersClient({
  members,
  clubs,
  importantLinks,
  communityLinks,
}: {
  members: Member[];
  clubs: Club[];
  importantLinks: LinkRow[];
  communityLinks: LinkRow[];
}) {
```

(e) 컴포넌트 본문에서 `CLUBS`를 참조하던 곳을 `clubs`로, `IMPORTANT_LINKS`→`importantLinks`, `COMMUNITY_LINKS`→`communityLinks`로 교체.

(f) 동아리 카드에서 색상 클래스를 쓰던 곳(`club.color`)을 `getClubColor(club.colorPreset)`로 교체.

(g) 링크 항목 렌더링에서 `link.labelEn`/`link.descriptionEn`이 `null`일 수 있으므로 `lang === "en" ? (link.labelEn ?? link.label) : link.label` 형태로 안전 접근.

- [ ] **Step 3: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`color` → `colorPreset` 전환, `CLUBS` 제거에 따른 미사용 import 정리 포함)

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: 에러 없음(미사용 import 경고 없도록 `lib/links` import 완전 제거 확인).

- [ ] **Step 5: 시각 확인**

`npm run dev` → `/members` 동아리 섹션 MR·질주가 기존과 동일(색상·활동 목록 포함), 링크 섹션도 동일하게 표시. KO/EN 토글 동작.

- [ ] **Step 6: 커밋**

```bash
git add app/members/page.tsx app/members/members-client.tsx
git commit -m "feat(members): 동아리·링크를 Club/SiteLink(DB)에서 표시"
```

---

## Task 14: lib/links.ts 정리 + 최종 검증

**Files:**
- Modify: `lib/links.ts` (주석으로 fallback 용도 명시)

- [ ] **Step 1: lib/links.ts 용도 주석 갱신**

`lib/links.ts` 최상단 주석을 교체(상수는 Footer fallback·시드 출처로 유지하므로 삭제하지 않음):

```ts
// [DEPRECATED as live source] 이 상수들은 이제 DB(SiteLink)로 이관되었습니다.
// 남겨둔 이유: 시드 스크립트(scripts/seed-site-settings.mjs)의 출처 기록 및 fallback 참고용.
// 공개 페이지는 /api/site-links 또는 서버 조회 결과를 사용합니다. 이 파일을 수정해도 사이트에 반영되지 않습니다.
```

> 다른 곳에서 아직 `IMPORTANT_LINKS`/`COMMUNITY_LINKS`를 import하는지 확인:
> Run: `grep -rn "from \"@/lib/links\"\|from '@/lib/links'" app components`
> 결과가 없어야 정상(Task 13에서 members가 마지막 소비처였음). 남아있으면 해당 파일도 DB 소비로 전환.

- [ ] **Step 2: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 에러 없음.

- [ ] **Step 4: 프로덕션 빌드 (로컬, file: DB이므로 libsql-migrate 스킵됨)**

Run: `npm run build`
Expected: 빌드 성공. `[libsql-migrate] ... file: 입니다. ... 스킵` 로그 후 `next build` 통과.

- [ ] **Step 5: 전 기능 수동 회귀 확인**

`npm run dev`로 다음 확인:
- `/admin/site`: 운영시간 변경(예: 토요일 휴무 해제, 10:00-14:00) → 저장 → 홈 새로고침 시 주말 행에 반영.
- 링크 추가/수정/삭제 → `/members`·Footer 반영.
- 동아리 추가(색상 orange) → `/members`에 카드 추가, 색상 적용.
- KO/EN 토글로 EN 값 표시 확인.
- 잘못된 입력: 운영시간 종료<시작, 빈 URL → 저장 시 에러 메시지.

- [ ] **Step 6: 순수 함수 테스트 재실행**

Run: `node --experimental-strip-types scripts/site-settings.test.mjs`
Expected: `✅ site-settings.test.mjs 통과`

- [ ] **Step 7: 커밋**

```bash
git add lib/links.ts
git commit -m "chore(links): lib/links.ts를 DB 이관에 따라 fallback/시드 출처로 강등"
```

---

## 완료 기준 (전체)

- [ ] `/admin/site`에서 운영시간·연락처·링크·동아리 CRUD + 정렬 + 노출토글 동작
- [ ] 홈·Footer·members가 DB 값을 표시, 시드 직후 외관이 기존과 동일(회귀 없음)
- [ ] KO/EN 토글이 입력된 EN 값에 따라 동작
- [ ] 잘못된 입력은 API 검증에서 차단
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
- [ ] `scripts/site-settings.test.mjs` 통과
- [ ] 프로덕션: 빌드 시 `libsql-migrate.mjs`가 `add_site_settings` 적용 + 배포 후 `node scripts/seed-site-settings.mjs`(또는 Turso에 대해 DATABASE_URL/TURSO_AUTH_TOKEN 설정 후) 1회 실행 필요 — 운영 메모로 README/HANDOVER에 기록
```

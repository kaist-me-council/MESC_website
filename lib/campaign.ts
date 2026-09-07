/**
 * 학생회 이벤트(신청·구매 캠페인) — 서버 전용 헬퍼.
 * 설계: docs/superpowers/specs/2026-09-07-campaign-system-design.md §3, campaign-v2-design.md §2
 */
import { randomBytes } from "node:crypto";
import type { Campaign, CampaignOption, CampaignOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidString } from "@/lib/validation";
import { parseCsv, parseDistributionCsv, type ImportRow } from "@/lib/tshirt-parse";

export const AFFILIATIONS = ["학부생", "대학원생", "교수님", "졸업생", "기타"] as const;
export const ORDER_STATUSES = ["pending", "paid", "delivered", "cancelled"] as const;
export const CAMPAIGN_KINDS = ["goods", "signup"] as const;
export const CHOICES = ["pickup", "refund", "exchange"] as const;

export interface OrderItem {
  optionId: number;
  group: string | null;
  name: string;
  qty: number;
  unitPrice: number;
}

/** 수령 확인에서 못 받은 항목에 대한 본인 선택 (주문 items 와 optionId 로 1:1) */
export interface Resolution {
  optionId: number;
  group: string | null;
  name: string;
  qty: number;
  choice: (typeof CHOICES)[number];
  exchangeName?: string;
}

export function isOpen(c: Pick<Campaign, "enabled" | "opensAt" | "closesAt">, now = Date.now()): boolean {
  if (!c.enabled) return false;
  if (c.opensAt && now < c.opensAt.getTime()) return false;
  if (c.closesAt && now >= c.closesAt.getTime()) return false;
  return true;
}

export function isConfirmOpen(c: Pick<Campaign, "enabled" | "confirmEnabled" | "confirmDeadline">, now = Date.now()): boolean {
  return c.enabled && c.confirmEnabled && (!c.confirmDeadline || now <= c.confirmDeadline.getTime());
}

export function parsePriceAdjust(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    const o = JSON.parse(json);
    return o && typeof o === "object" ? (o as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function unitPrice(option: Pick<CampaignOption, "price">, campaign: Pick<Campaign, "priceAdjust">, affiliation: string): number {
  return option.price + (parsePriceAdjust(campaign.priceAdjust)[affiliation] ?? 0);
}

/** optionId → 남은 수량 (stock null 이면 null). 취소 제외 주문 수량 합을 뺀다. */
export async function availability(campaignId: number): Promise<Map<number, number | null>> {
  const options = await prisma.campaignOption.findMany({ where: { campaignId }, select: { id: true, stock: true } });
  // 재고 제한 옵션이 하나도 없으면 주문 스캔 생략 (공개 페이지 조회마다 호출되므로)
  if (options.every((o) => o.stock === null)) return new Map(options.map((o) => [o.id, null]));
  const orders = await prisma.campaignOrder.findMany({ where: { campaignId, status: { not: "cancelled" } }, select: { items: true } });
  const used = new Map<number, number>();
  for (const o of orders) {
    for (const it of JSON.parse(o.items) as OrderItem[]) used.set(it.optionId, (used.get(it.optionId) ?? 0) + it.qty);
  }
  return new Map(options.map((o) => [o.id, o.stock === null ? null : o.stock - (used.get(o.id) ?? 0)]));
}

export function makeOrderNo(slug: string): string {
  const prefix = slug.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O/1/I 제외
  const bytes = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${s}`;
}

/** images JSON → string[] (없으면 imageUrl 하나) */
export function parseImages(c: { images: string | null; imageUrl: string | null }): string[] {
  try { const a = c.images ? JSON.parse(c.images) : null; if (Array.isArray(a) && a.length) return a.filter((u) => typeof u === "string"); } catch { /* fallthrough */ }
  return c.imageUrl ? [c.imageUrl] : [];
}

export function publicCampaign(c: Campaign & { options: CampaignOption[] }, avail: Map<number, number | null>) {
  return {
    slug: c.slug,
    title: c.title,
    titleEn: c.titleEn,
    description: c.description,
    descriptionEn: c.descriptionEn,
    kind: c.kind,
    imageUrl: c.imageUrl,
    images: parseImages(c),
    open: isOpen(c),
    opensAt: c.opensAt,
    closesAt: c.closesAt,
    afterNote: c.afterNote,
    afterNoteEn: c.afterNoteEn,
    allowQty: c.allowQty,
    maxPerPerson: c.maxPerPerson,
    requireStudentId: c.requireStudentId,
    priceAdjust: parsePriceAdjust(c.priceAdjust),
    confirmEnabled: c.confirmEnabled,
    confirmDeadline: c.confirmDeadline,
    confirmNote: c.confirmNote,
    confirmNoteEn: c.confirmNoteEn,
    confirmOpen: isConfirmOpen(c),
    options: c.options
      .filter((o) => o.enabled)
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map((o) => ({ id: o.id, group: o.group, name: o.name, nameEn: o.nameEn, price: o.price, remaining: avail.get(o.id) ?? null })),
  };
}

/** 본인 조회·완료 화면용. 해시·전화·관리자메모 제외, 계좌·안내는 포함. */
export function publicOrder(
  o: CampaignOrder,
  c: Pick<Campaign, "bankInfo" | "afterNote" | "afterNoteEn" | "title" | "titleEn" | "slug" | "enabled" | "confirmEnabled" | "confirmDeadline">,
) {
  return {
    orderNo: o.orderNo,
    status: o.status,
    affiliation: o.affiliation,
    name: o.name,
    depositorName: o.depositorName,
    items: JSON.parse(o.items) as OrderItem[],
    total: o.total,
    note: o.note,
    source: o.source,
    confirmation: o.confirmation,
    resolution: o.resolution ? (JSON.parse(o.resolution) as Resolution[]) : null,
    confirmNote: o.confirmNote,
    confirmedAt: o.confirmedAt,
    canCancel: o.status === "pending",
    createdAt: o.createdAt,
    campaign: {
      slug: c.slug, title: c.title, titleEn: c.titleEn, bankInfo: c.bankInfo, afterNote: c.afterNote, afterNoteEn: c.afterNoteEn,
      confirmOpen: isConfirmOpen(c), confirmDeadline: c.confirmDeadline,
    },
  };
}

export const normName = (s: string) => s.replace(/\s+/g, "").toLowerCase();
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 100;

/** 공개 API 본인 확인 — 주문번호 단독 또는 이름+(학번해시|이메일). 셋 다 없으면 null. */
export type OwnerCred = { orderNo: string } | { name: string; studentIdHash: string | null; email: string | null };
export function parseOwnerCred(b: Record<string, unknown>, hash: (sid: string) => string): OwnerCred | null {
  const orderNo = typeof b.orderNo === "string" ? b.orderNo.trim().toUpperCase() : "";
  const studentId = typeof b.studentId === "string" ? b.studentId.replace(/\D/g, "") : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name && name.length <= 50 && (studentId || isEmail(email))) return { name, studentIdHash: studentId ? hash(studentId) : null, email: isEmail(email) ? email : null };
  if (/^[A-Z0-9]{4}-[A-Z0-9]{6}$/.test(orderNo)) return { orderNo };
  return null;
}

/** 본인 주문 조회. orderNo 면 그 한 건, 아니면 이름+(학번해시|이메일) 일치 전부. */
export async function findOwnOrders(campaignId: number, cred: OwnerCred) {
  if ("orderNo" in cred) {
    const o = await prisma.campaignOrder.findUnique({ where: { orderNo: cred.orderNo } });
    return o && o.campaignId === campaignId ? [o] : [];
  }
  const or = [];
  if (cred.studentIdHash) or.push({ studentIdHash: cred.studentIdHash });
  if (cred.email) or.push({ email: cred.email });
  if (!or.length) return [];
  const rows = await prisma.campaignOrder.findMany({ where: { campaignId, OR: or }, orderBy: { createdAt: "desc" } });
  return rows.filter((o) => normName(o.name) === normName(cred.name));
}

/** 관리자 주문 항목 수정: [{optionId, qty}] → OrderItem[] + total. 옵션은 이 캠페인 소속·enabled 만. 오류면 문자열. */
export function rebuildItems(options: CampaignOption[], campaign: Pick<Campaign, "priceAdjust">, affiliation: string, raw: unknown): { items: OrderItem[]; total: number } | string {
  if (!Array.isArray(raw) || !raw.length) return "항목을 하나 이상 넣어주세요.";
  const byId = new Map(options.filter((o) => o.enabled).map((o) => [o.id, o]));
  const merged = new Map<number, number>();
  for (const it of raw as { optionId?: unknown; qty?: unknown }[]) {
    const id = Number(it.optionId);
    const qty = Number(it.qty);
    if (!byId.has(id)) return "이 캠페인의 옵션이 아니거나 사용 중지된 옵션입니다.";
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return "수량은 1~99 사이여야 합니다.";
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  const items: OrderItem[] = [...merged].map(([id, qty]) => { const o = byId.get(id)!; return { optionId: id, group: o.group, name: o.name, qty, unitPrice: unitPrice(o, campaign, affiliation) }; });
  return { items, total: items.reduce((a, it) => a + it.qty * it.unitPrice, 0) };
}

// ---- import ----
export interface ImportOrderRow {
  affiliation: string;
  name: string;
  studentIdHash: string | null;
  email: string;
  phone: string | null;
  items: { group: string | null; name: string; qty: number }[];
  status: (typeof ORDER_STATUSES)[number];
  handedBy?: string | null;
}

const keyOf = (group: string | null, name: string) => `${(group ?? "").trim()} ${name.trim()}`;

/** 없는 (group,name) 옵션을 만들고 key→id 맵 반환 (가격 0, 재고 무제한). 만든 목록도 돌려준다. */
export async function ensureOptions(campaignId: number, pairs: { group: string | null; name: string }[], dryRun = false) {
  const existing = await prisma.campaignOption.findMany({ where: { campaignId } });
  const map = new Map(existing.map((o) => [keyOf(o.group, o.name), o.id]));
  const missing = new Map<string, { group: string | null; name: string }>();
  for (const p of pairs) if (!map.has(keyOf(p.group, p.name))) missing.set(keyOf(p.group, p.name), { group: p.group?.trim() || null, name: p.name.trim() });
  if (!dryRun && missing.size) {
    let order = existing.length;
    for (const m of missing.values()) {
      const created = await prisma.campaignOption.create({ data: { campaignId, group: m.group, name: m.name, order: order++ } });
      map.set(keyOf(m.group, m.name), created.id);
    }
  }
  return { map, created: [...missing.values()] };
}

/** rows → 주문 생성(source import). 옵션이 없으면 만들고, 금액은 단가×수량. */
export async function importOrders(campaign: Campaign, rows: ImportOrderRow[]) {
  const { map, created } = await ensureOptions(campaign.id, rows.flatMap((r) => r.items));
  const options = await prisma.campaignOption.findMany({ where: { campaignId: campaign.id } });
  const byId = new Map(options.map((o) => [o.id, o]));
  await prisma.campaignOrder.createMany({
    data: rows.map((r) => {
      const items: OrderItem[] = r.items.map((it) => {
        const id = map.get(keyOf(it.group, it.name))!;
        return { optionId: id, group: byId.get(id)!.group, name: byId.get(id)!.name, qty: it.qty, unitPrice: unitPrice(byId.get(id)!, campaign, r.affiliation) };
      });
      return {
        campaignId: campaign.id,
        orderNo: makeOrderNo(campaign.slug),
        affiliation: r.affiliation,
        name: r.name,
        studentIdHash: r.studentIdHash,
        email: r.email,
        phone: r.phone,
        items: JSON.stringify(items),
        total: items.reduce((a, it) => a + it.qty * it.unitPrice, 0),
        status: r.status,
        handedBy: r.handedBy ?? null,
        source: "import",
      };
    }),
  });
  return { imported: rows.length, createdOptions: created };
}

const STATUS_FROM_KO: Record<string, ImportOrderRow["status"]> = { 대기: "pending", 입금: "paid", 수령: "delivered", 취소: "cancelled", pending: "pending", paid: "paid", delivered: "delivered", cancelled: "cancelled" };

/** 일반 CSV: 구분,이름,학번,전화,이메일,항목,상태. 항목 = "흰색 XL×1; 검정 L×2" */
export function parseGenericOrdersCsv(text: string, hash: (sid: string) => string): { rows: ImportOrderRow[]; problems: string[] } {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], problems: ["CSV 에 데이터 행이 없습니다."] };
  const header = all[0].map((h) => h.trim());
  const col = (label: string) => header.findIndex((h) => h.includes(label));
  const ci = { aff: col("구분"), name: col("이름"), sid: col("학번"), phone: col("전화"), email: col("이메일"), items: col("항목"), status: col("상태") };
  const missing = Object.entries(ci).filter(([k, v]) => v < 0 && k !== "status" && k !== "phone" && k !== "sid").map(([k]) => k);
  if (missing.length) return { rows: [], problems: [`헤더에서 열을 찾지 못함: ${missing.join(", ")}`] };
  const rows: ImportOrderRow[] = [];
  const problems: string[] = [];
  all.slice(1).forEach((r, idx) => {
    const name = (r[ci.name] ?? "").trim();
    if (!name) { problems.push(`${idx + 2}행: 이름 없음`); return; }
    const items: ImportOrderRow["items"] = [];
    const bad: string[] = [];
    for (const part of (r[ci.items] ?? "").split(/[;,]/)) {
      const p = part.trim();
      if (!p) continue;
      const m = p.match(/^(.*?)\s*[×xX*]\s*(\d+)$/);
      const label = (m ? m[1] : p).trim();
      const qty = m ? parseInt(m[2], 10) : 1;
      const sp = label.lastIndexOf(" ");
      const group = sp > 0 ? label.slice(0, sp).trim() : null;
      const nm = sp > 0 ? label.slice(sp + 1).trim() : label;
      if (!nm || qty < 1) { bad.push(p); continue; }
      items.push({ group, name: nm, qty });
    }
    if (bad.length) problems.push(`${idx + 2}행 ${name}: 해석 불가 "${bad.join('", "')}"`);
    const statusRaw = ci.status >= 0 ? (r[ci.status] ?? "").trim() : "";
    const status = statusRaw ? STATUS_FROM_KO[statusRaw] : "paid";
    if (!status) { problems.push(`${idx + 2}행 ${name}: 상태 "${statusRaw}" 인식 불가`); return; }
    const sidRaw = ci.sid >= 0 ? (r[ci.sid] ?? "").replace(/\D/g, "") : "";
    const affiliation = (r[ci.aff] ?? "").trim().replace(/\(.*?\)/g, "").trim();
    rows.push({
      affiliation: (AFFILIATIONS as readonly string[]).includes(affiliation) ? affiliation : "기타",
      name,
      studentIdHash: sidRaw ? hash(sidRaw) : null,
      email: (r[ci.email] ?? "").trim().toLowerCase(),
      phone: ci.phone >= 0 ? (r[ci.phone] ?? "").trim() || null : null,
      items,
      status,
    });
  });
  return { rows, problems };
}

/** 배부 시트(나눠주기) 파서 결과 → 주문 행. 그룹 흰색/검정, 이름 사이즈. 픽업 O = 수령, 아니면 입금. */
export function tshirtRowsToOrders(rows: ImportRow[]): ImportOrderRow[] {
  return rows.map((r) => {
    const aff = r.affiliation.replace(/\(.*?\)/g, "").replace(/^추가/, "").trim();
    return {
      affiliation: (AFFILIATIONS as readonly string[]).includes(aff) ? aff : "기타",
      name: r.name,
      studentIdHash: r.studentIdHash,
      email: r.email,
      phone: r.phone,
      items: r.items.map((it) => ({ group: it.color === "white" ? "흰색" : "검정", name: it.size, qty: it.qty })),
      status: r.pickedUp ? "delivered" : "paid",
      handedBy: r.pickedUp ? r.handedBy ?? null : null,
    };
  });
}

export function parseImportCsv(mode: string, text: string, hash: (sid: string) => string) {
  if (mode === "tshirt") {
    const { rows, problems } = parseDistributionCsv(text, hash);
    return { rows: tshirtRowsToOrders(rows), problems };
  }
  return parseGenericOrdersCsv(text, hash);
}

// ---- 프리셋 ----
export const PRESETS: Record<string, { data: Omit<Parameters<typeof prisma.campaign.create>[0]["data"], "options" | "orders">; options: { group: string | null; name: string; price: number; stock: number | null; order: number }[] }> = {
  "tshirt-2026-spring": {
    data: {
      slug: "2026-spring-tshirt",
      title: "2026 상반기 기계과 반팔티",
      titleEn: "2026 Spring ME T-shirt",
      kind: "goods",
      enabled: true,
      closesAt: new Date("2026-06-30T23:59:59+09:00"),
      confirmEnabled: true,
      confirmDeadline: new Date("2026-09-13T23:59:59+09:00"),
      confirmNote: "상반기에 주문하신 반팔티를 받으셨는지 확인해 주세요. 못 받은 항목은 재고가 있으면 학생회실(N7)에서 드리고, 없으면 환불 또는 교환해 드립니다. 환불 계좌는 개별 연락으로 받습니다.",
      confirmNoteEn: "Please confirm whether you received the T-shirt you ordered this spring. For missing items we hand them over at the council room (N7) if in stock; otherwise we refund or exchange. Refund details are collected individually.",
    },
    options: ["흰색", "검정"].flatMap((group, gi) => ["S", "M", "L", "XL", "2XL", "3XL", "4XL"].map((name, i) => ({ group, name, price: 0, stock: null, order: gi * 10 + i }))),
  },
};

// ---- 관리자 body 파서 (app/api/admin/campaigns/*) ----
export interface OptionInput {
  id?: number;
  group: string | null;
  name: string;
  nameEn: string | null;
  price: number;
  stock: number | null;
  order: number;
  enabled: boolean;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const date = (v: unknown) => (typeof v === "string" && v ? (isNaN(new Date(v).getTime()) ? undefined : new Date(v)) : null);
const int = (v: unknown, fallback: number | null) => (v === null || v === "" || v === undefined ? fallback : Number.isInteger(Number(v)) ? Number(v) : fallback);

/** Campaign 필드 검증. 반환 error 있으면 400. options 는 별도 반환 (없으면 undefined) */
export function parseCampaignBody(b: Record<string, unknown>) {
  if (!isValidString(b.title, 200)) return { error: "제목은 1~200자 이내여야 합니다." };
  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return { error: "slug 는 영문 소문자·숫자·하이픈만 사용합니다." };
  const opensAt = date(b.opensAt);
  const closesAt = date(b.closesAt);
  const confirmDeadline = date(b.confirmDeadline);
  if (opensAt === undefined || closesAt === undefined || confirmDeadline === undefined) return { error: "날짜 형식이 올바르지 않습니다." };
  // priceAdjust: 객체 또는 JSON 문자열 둘 다 허용 (관리자 화면은 문자열로 보냄)
  let priceAdjust: string | null = null;
  let adjRaw: unknown = b.priceAdjust;
  if (typeof adjRaw === "string") { try { adjRaw = JSON.parse(adjRaw); } catch { adjRaw = null; } }
  if (adjRaw && typeof adjRaw === "object") {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(adjRaw as Record<string, unknown>)) if (Number.isInteger(Number(v)) && Number(v) !== 0) clean[k.slice(0, 20)] = Number(v);
    priceAdjust = Object.keys(clean).length ? JSON.stringify(clean) : null;
  }
  // images: 배열 또는 JSON 문자열. http(s) URL 만, 최대 8장. imageUrl(대표) = images[0]
  let imgRaw: unknown = b.images;
  if (typeof imgRaw === "string") { try { imgRaw = JSON.parse(imgRaw); } catch { imgRaw = null; } }
  const images = Array.isArray(imgRaw)
    ? imgRaw.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u) && u.length <= 500).slice(0, 8)
    : null;
  const legacy = str(b.imageUrl, 500);
  if (legacy && !/^https?:\/\//.test(legacy)) return { error: "이미지 URL 형식이 올바르지 않습니다." };
  const imageUrl = images ? images[0] ?? null : legacy;
  const data = {
    slug,
    title: (b.title as string).trim(),
    titleEn: str(b.titleEn, 200),
    description: str(b.description, 5000),
    descriptionEn: str(b.descriptionEn, 5000),
    kind: (CAMPAIGN_KINDS as readonly string[]).includes(String(b.kind)) ? String(b.kind) : "signup",
    imageUrl,
    images: images ? JSON.stringify(images) : null,
    enabled: Boolean(b.enabled),
    opensAt,
    closesAt,
    bankInfo: str(b.bankInfo, 200),
    afterNote: str(b.afterNote, 1000),
    afterNoteEn: str(b.afterNoteEn, 1000),
    allowQty: b.allowQty === undefined ? true : Boolean(b.allowQty),
    maxPerPerson: int(b.maxPerPerson, null),
    order: int(b.order, 0) ?? 0,
    requireStudentId: b.requireStudentId === undefined ? true : Boolean(b.requireStudentId),
    priceAdjust,
    confirmEnabled: Boolean(b.confirmEnabled),
    confirmDeadline,
    confirmNote: str(b.confirmNote, 1000),
    confirmNoteEn: str(b.confirmNoteEn, 1000),
  };
  let options: OptionInput[] | undefined;
  if (Array.isArray(b.options)) {
    options = [];
    for (const [i, raw] of (b.options as Record<string, unknown>[]).entries()) {
      if (!isValidString(raw?.name, 100)) return { error: `${i + 1}번째 옵션 이름이 비어 있습니다.` };
      options.push({
        id: Number.isInteger(Number(raw.id)) && Number(raw.id) > 0 ? Number(raw.id) : undefined,
        group: str(raw.group, 50),
        name: raw.name.trim(),
        nameEn: str(raw.nameEn, 100),
        price: Math.max(0, int(raw.price, 0) ?? 0),
        stock: (() => { const s = int(raw.stock, null); return s === null ? null : Math.max(0, s); })(),
        order: int(raw.order, i) ?? i,
        enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
      });
    }
  }
  return { data, options };
}

/**
 * 학생회 이벤트(신청·구매 캠페인) — 서버 전용 헬퍼.
 * 설계: docs/superpowers/specs/2026-09-07-campaign-system-design.md §3
 */
import { randomBytes } from "node:crypto";
import type { Campaign, CampaignOption, CampaignOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidString } from "@/lib/validation";

export const AFFILIATIONS = ["학부생", "대학원생", "교수님", "졸업생", "기타"] as const;
export const ORDER_STATUSES = ["pending", "paid", "delivered", "cancelled"] as const;

export interface OrderItem {
  optionId: number;
  group: string | null;
  name: string;
  qty: number;
  unitPrice: number;
}

export function isOpen(c: Pick<Campaign, "enabled" | "opensAt" | "closesAt">, now = Date.now()): boolean {
  if (!c.enabled) return false;
  if (c.opensAt && now < c.opensAt.getTime()) return false;
  if (c.closesAt && now >= c.closesAt.getTime()) return false;
  return true;
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
  const [options, orders] = await Promise.all([
    prisma.campaignOption.findMany({ where: { campaignId }, select: { id: true, stock: true } }),
    prisma.campaignOrder.findMany({ where: { campaignId, status: { not: "cancelled" } }, select: { items: true } }),
  ]);
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

export function publicCampaign(c: Campaign & { options: CampaignOption[] }, avail: Map<number, number | null>) {
  return {
    slug: c.slug,
    title: c.title,
    titleEn: c.titleEn,
    description: c.description,
    descriptionEn: c.descriptionEn,
    open: isOpen(c),
    opensAt: c.opensAt,
    closesAt: c.closesAt,
    afterNote: c.afterNote,
    afterNoteEn: c.afterNoteEn,
    allowQty: c.allowQty,
    maxPerPerson: c.maxPerPerson,
    requireStudentId: c.requireStudentId,
    priceAdjust: parsePriceAdjust(c.priceAdjust),
    options: c.options
      .filter((o) => o.enabled)
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map((o) => ({ id: o.id, group: o.group, name: o.name, nameEn: o.nameEn, price: o.price, remaining: avail.get(o.id) ?? null })),
  };
}

/** 본인 조회·완료 화면용. 해시·전화·관리자메모 제외, 계좌·안내는 포함. */
export function publicOrder(o: CampaignOrder, c: Pick<Campaign, "bankInfo" | "afterNote" | "afterNoteEn" | "title" | "titleEn" | "slug">) {
  return {
    orderNo: o.orderNo,
    status: o.status,
    affiliation: o.affiliation,
    name: o.name,
    items: JSON.parse(o.items) as OrderItem[],
    total: o.total,
    note: o.note,
    createdAt: o.createdAt,
    campaign: { slug: c.slug, title: c.title, titleEn: c.titleEn, bankInfo: c.bankInfo, afterNote: c.afterNote, afterNoteEn: c.afterNoteEn },
  };
}

export const normName = (s: string) => s.replace(/\s+/g, "").toLowerCase();
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 100;

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
  if (opensAt === undefined || closesAt === undefined) return { error: "날짜 형식이 올바르지 않습니다." };
  let priceAdjust: string | null = null;
  if (b.priceAdjust && typeof b.priceAdjust === "object") {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(b.priceAdjust as Record<string, unknown>)) if (Number.isInteger(Number(v)) && Number(v) !== 0) clean[k.slice(0, 20)] = Number(v);
    priceAdjust = Object.keys(clean).length ? JSON.stringify(clean) : null;
  }
  const data = {
    slug,
    title: (b.title as string).trim(),
    titleEn: str(b.titleEn, 200),
    description: str(b.description, 5000),
    descriptionEn: str(b.descriptionEn, 5000),
    enabled: Boolean(b.enabled),
    opensAt,
    closesAt,
    bankInfo: str(b.bankInfo, 200),
    afterNote: str(b.afterNote, 1000),
    afterNoteEn: str(b.afterNoteEn, 1000),
    allowQty: b.allowQty === undefined ? true : Boolean(b.allowQty),
    maxPerPerson: int(b.maxPerPerson, null),
    requireStudentId: b.requireStudentId === undefined ? true : Boolean(b.requireStudentId),
    priceAdjust,
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


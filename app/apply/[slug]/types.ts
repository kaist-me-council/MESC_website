// 공개 캠페인 화면 공용 타입 (API 계약: docs/superpowers/specs/2026-09-07-campaign-v2-design.md)
export const AFFILIATIONS = ["학부생", "대학원생", "교수님", "졸업생", "기타"] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];

export interface Option { id: number; group: string | null; name: string; nameEn: string | null; price: number; remaining: number | null }

export interface Campaign {
  slug: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null;
  kind: "goods" | "signup"; imageUrl: string | null; images?: string[];
  open: boolean; opensAt: string | null; closesAt: string | null; afterNote: string | null; afterNoteEn: string | null;
  allowQty: boolean; maxPerPerson: number | null; requireStudentId: boolean; priceAdjust: Record<string, number>; options: Option[];
  confirmEnabled: boolean; confirmDeadline: string | null; confirmNote: string | null; confirmNoteEn: string | null; confirmOpen: boolean;
}

export interface OrderItem { optionId: number; group: string | null; name: string; qty: number; unitPrice: number }
export type Choice = "pickup" | "refund" | "exchange";
export interface Resolution extends OrderItem { choice: Choice; exchangeName?: string }

export interface Order {
  orderNo: string; status: "pending" | "paid" | "delivered" | "cancelled"; items: OrderItem[]; total: number; createdAt: string;
  affiliation: string; name: string; source?: "web" | "import";
  confirmation?: "received" | "not_received" | null; resolution?: Resolution[] | null; confirmNote?: string | null; confirmedAt?: string | null;
  canCancel?: boolean; bankInfo?: string | null; afterNote?: string | null; afterNoteEn?: string | null;
}

export type T = (k: string) => string;
/** "{n}" 또는 "{date}" 자리를 채운다 */
export const fill = (s: string, v: string | number) => s.replace("{n}", String(v)).replace("{date}", String(v));
export const localeOf = (lang: string) => (lang === "ko" ? "ko-KR" : "en-US");

/** 본인 확인용 자격 증명 (이름 + 학번 또는 이메일) */
export interface Cred { name: string; studentId?: string; email?: string }

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

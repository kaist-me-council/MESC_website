// 공개 캠페인 화면 공용 타입 (API 계약: docs/superpowers/specs/2026-09-07-campaign-v2-design.md)
export const AFFILIATIONS = ["학부생", "대학원생", "교수님", "졸업생", "기타"] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];

export interface Option { id: number; group: string | null; name: string; nameEn: string | null; price: number; remaining: number | null }

/** 캠페인마다 관리자가 정의하는 추가 문항. 답은 {문항id: 값} 으로 신청과 함께 보낸다. */
export interface Question {
  id: string;
  type: "text" | "radio" | "checkbox" | "consent";
  label: string;
  labelEn?: string | null;
  required: boolean;
  options?: string[];
}
export type Answer = string | string[] | boolean;

export interface Campaign {
  slug: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null;
  kind: "goods" | "signup"; imageUrl: string | null; images?: string[];
  open: boolean; opensAt: string | null; closesAt: string | null; afterNote: string | null; afterNoteEn: string | null;
  eventAt?: string | null; eventPlace?: string | null;
  /** 유료(입금 필요) 행사. true 면 bankInfo 가 함께 내려오고 "입금했습니다" 체크가 필수다. */
  requiresPayment?: boolean; bankInfo?: string | null;
  allowQty: boolean; maxPerPerson: number | null; requireStudentId: boolean; priceAdjust: Record<string, number>; options: Option[]; questions?: Question[];
  confirmEnabled: boolean; confirmDeadline: string | null; confirmNote: string | null; confirmNoteEn: string | null; confirmOpen: boolean;
  /** 비공개 캠페인을 관리자가 미리 보는 중 (학생에게는 404) */
  preview?: boolean;
}

export interface OrderItem { optionId: number; group: string | null; name: string; qty: number; unitPrice: number }
export type Choice = "pickup" | "refund" | "exchange";
export interface Resolution extends OrderItem { choice: Choice; exchangeName?: string }

export interface Order {
  orderNo: string; status: "pending" | "paid" | "delivered" | "cancelled"; items: OrderItem[]; total: number; createdAt: string;
  affiliation: string; name: string; depositorName?: string | null; source?: "web" | "import";
  confirmation?: "received" | "not_received" | null; resolution?: Resolution[] | null; confirmNote?: string | null; confirmedAt?: string | null;
  canCancel?: boolean;
  /** 계좌·안내문은 여기 안에 있다. 평평한 order.bankInfo 로 읽으면 안 보인다 (publicOrder 계약). */
  campaign?: { slug?: string; title?: string; titleEn?: string | null; bankInfo?: string | null; afterNote?: string | null; afterNoteEn?: string | null; confirmOpen?: boolean; confirmDeadline?: string | null };
  /** 신청 직후 1회만 내려오는 평문 관리 코드 (취소에 필요). 재전송(idempotent replay)이면 없다. */
  manageCode?: string | null;
}

export type { T } from "@/lib/fetch-state";
/** "{n}" 또는 "{date}" 자리를 채운다 */
// 자리표시자는 문구마다 이름이 다르다. 하나라도 빠지면 학생 화면에 "{name}" 이 그대로 보인다.
export const fill = (s: string, v: string | number) =>
  s.replace("{n}", String(v)).replace("{date}", String(v)).replace("{name}", String(v));
export const localeOf = (lang: string) => (lang === "ko" ? "ko-KR" : "en-US");

/** 본인 확인용 자격 증명 (이름 + 학번 또는 이메일) */
export interface Cred { name?: string; studentId?: string; email?: string; orderNo?: string }

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/* 요청 헬퍼는 lib/fetch-state.ts 로 옮겼다 (공지·커뮤니티 등 공개 화면 공용). */
export { request, errText, newIdemKey } from "@/lib/fetch-state";
export type { FailKind, ReqFail, ReqResult } from "@/lib/fetch-state";

export interface Option { id?: number; group: string; name: string; nameEn: string; price: number; stock: number | null; order: number; enabled: boolean }

/** 신청 폼에 덧붙이는 추가 문항. 답변·CSV 컬럼이 id 에 묶인다 — 한 번 받은 문항의 id 는 바꾸지 않는다. */
export interface Question {
  id: string;
  type: "text" | "radio" | "checkbox" | "consent";
  label: string;
  labelEn?: string | null;
  required: boolean;
  options?: string[];
}

export interface Campaign {
  id: number; slug: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null;
  kind: "goods" | "signup"; imageUrl: string | null; images?: string | string[] | null;
  enabled: boolean; opensAt: string | null; closesAt: string | null; bankInfo: string | null; bankName: string | null; accountNumber: string | null; afterNote: string | null; afterNoteEn: string | null;
  eventAt?: string | null; eventPlace?: string | null; requiresPayment?: boolean; showRemaining: boolean;
  allowQty: boolean; maxPerPerson: number | null; requireStudentId: boolean; requirePhone: boolean; priceAdjust: string | null; order?: number;
  confirmEnabled: boolean; confirmDeadline: string | null; confirmNote: string | null; confirmNoteEn: string | null;
  questions?: Question[] | string | null;
  options: Option[];
}

/** questions 는 JSON 문자열 또는 배열로 온다. */
export function readQuestions(c: { questions?: Question[] | string | null }): Question[] {
  const raw = c.questions;
  if (Array.isArray(raw)) return raw;
  try { const a = raw ? JSON.parse(raw) : null; if (Array.isArray(a)) return a; } catch { /* ignore */ }
  return [];
}

/** 답변 한 줄 표기 (CSV 와 같은 규칙) */
export function answerText(q: Question, v: string | string[] | boolean | undefined): string {
  if (q.type === "consent") return v === true ? "O" : "";
  if (Array.isArray(v)) return v.join(", ");
  return typeof v === "string" ? v : "";
}

export interface OrderItem { optionId: number; group: string | null; name: string; qty: number; unitPrice: number }
export type Status = "pending" | "paid" | "delivered" | "cancelled";
export type Choice = "pickup" | "refund" | "exchange";
export interface ResolutionItem { optionId: number; group: string | null; name: string; qty: number; choice: Choice; exchangeName?: string | null }

export interface Order {
  id: number; orderNo: string; affiliation: string; name: string; email: string; phone: string | null;
  items: OrderItem[] | string; total: number; status: Status; note: string | null; adminMemo: string | null; createdAt: string;
  depositorName?: string | null;
  source?: "web" | "import";
  confirmation?: "received" | "not_received" | null;
  resolution?: ResolutionItem[] | string | null;
  confirmNote?: string | null;
  confirmedAt?: string | null;
  resolvedAt?: string | null;
  refundedAt?: string | null;
  handedBy?: string | null;
  attendedAt?: string | null;
  depositCheckedAt?: string | null;
  answers?: Record<string, string | string[] | boolean>;
}

export const STATUS_LABEL: Record<Status, string> = { pending: "대기", paid: "입금", delivered: "수령", cancelled: "취소" };
export const STATUS_VARIANT: Record<Status, "outline" | "secondary" | "default" | "destructive"> = { pending: "outline", paid: "secondary", delivered: "default", cancelled: "destructive" };
export const CHOICE_LABEL: Record<Choice, string> = { pickup: "수령", refund: "환불", exchange: "교환" };

export const parseItems = (o: Order): OrderItem[] => (typeof o.items === "string" ? JSON.parse(o.items) : o.items ?? []);
export const parseResolution = (o: Order): ResolutionItem[] | null => {
  if (!o.resolution) return null;
  return typeof o.resolution === "string" ? JSON.parse(o.resolution) : o.resolution;
};
export const itemLabel = (it: { group: string | null; name: string }) => `${it.group ? it.group + " " : ""}${it.name}`;

// datetime-local ↔ ISO (로컬 시간 기준)
export const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

/** 주문 상태·메모 갱신 (단건 또는 일괄). 신청 목록·수령 확인 탭 공용. */
export async function putOrder(campaignId: number, body: object) {
  await fetch(`/api/admin/campaigns/${campaignId}/orders`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 중복 제거한 이메일을 클립보드로. 복사한 개수를 반환. */
export async function copyEmails(rows: Order[]): Promise<number> {
  const emails = [...new Set(rows.map((o) => o.email.trim().toLowerCase()).filter(Boolean))];
  await navigator.clipboard.writeText(emails.join(", "));
  return emails.length;
}

/**
 * 보증금 환불 대상: 참석 확인된 건 중 아직 환불 처리가 안 된 것.
 * (체육대회처럼 "참석하면 보증금을 돌려준다" 는 캠페인에서 쓴다. 불참자는 대상이 아니다.)
 */
export const depositRefundDue = (o: Order): boolean => o.total > 0 && !!o.attendedAt && !o.refundedAt && o.status !== "cancelled";

/** 환불이 필요해 보이는 주문: 입금 후 취소됐거나, 못 받음 응답에서 환불을 희망한 건. */
export const needsRefund = (o: Order): boolean => {
  if (o.total <= 0) return false;
  if (o.status === "cancelled") return true;
  return o.confirmation === "not_received" && (parseResolution(o) ?? []).some((r) => r.choice === "refund");
};

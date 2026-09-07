export interface Option { id?: number; group: string; name: string; nameEn: string; price: number; stock: number | null; order: number; enabled: boolean }

export interface Campaign {
  id: number; slug: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null;
  kind: "goods" | "signup"; imageUrl: string | null; images?: string | string[] | null;
  enabled: boolean; opensAt: string | null; closesAt: string | null; bankInfo: string | null; afterNote: string | null; afterNoteEn: string | null;
  allowQty: boolean; maxPerPerson: number | null; requireStudentId: boolean; priceAdjust: string | null; order?: number;
  confirmEnabled: boolean; confirmDeadline: string | null; confirmNote: string | null; confirmNoteEn: string | null;
  options: Option[];
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

/** 환불이 필요해 보이는 주문: 입금 후 취소됐거나, 못 받음 응답에서 환불을 희망한 건. */
export const needsRefund = (o: Order): boolean => {
  if (o.total <= 0) return false;
  if (o.status === "cancelled") return true;
  return o.confirmation === "not_received" && (parseResolution(o) ?? []).some((r) => r.choice === "refund");
};

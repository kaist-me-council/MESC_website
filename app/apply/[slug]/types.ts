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
  affiliation: string; name: string; depositorName?: string | null; source?: "web" | "import";
  confirmation?: "received" | "not_received" | null; resolution?: Resolution[] | null; confirmNote?: string | null; confirmedAt?: string | null;
  canCancel?: boolean; bankInfo?: string | null; afterNote?: string | null; afterNoteEn?: string | null;
  /** 신청 직후 1회만 내려오는 평문 관리 코드 (취소에 필요). 재전송(idempotent replay)이면 없다. */
  manageCode?: string | null;
}

export type T = (k: string) => string;
/** "{n}" 또는 "{date}" 자리를 채운다 */
export const fill = (s: string, v: string | number) => s.replace("{n}", String(v)).replace("{date}", String(v));
export const localeOf = (lang: string) => (lang === "ko" ? "ko-KR" : "en-US");

/** 본인 확인용 자격 증명 (이름 + 학번 또는 이메일) */
export interface Cred { name?: string; studentId?: string; email?: string; orderNo?: string }

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/* ── 공개 화면 요청 헬퍼 ────────────────────────────────────────────────
   통신 실패(network/5xx/429)와 "결과가 비어 있음"을 절대 섞지 않기 위해,
   모든 fetch 를 성공/실패 판별 결과로 바꾼다. 문구는 렌더 시점에 errText 로
   만든다(여기서 t 를 받으면 useCallback 의존성이 매 렌더 바뀐다). */
export type FailKind = "network" | "ratelimit" | "client" | "server";
export interface ReqFail { ok: false; kind: FailKind; status: number; error?: string; body: Record<string, unknown> }
export type ReqResult<D> = { ok: true; data: D } | ReqFail;

export async function request<D>(url: string, init?: RequestInit): Promise<ReqResult<D>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false, kind: "network", status: 0, body: {} };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, data: body as D };
  const kind: FailKind = res.status === 429 ? "ratelimit" : res.status >= 500 ? "server" : "client";
  return { ok: false, kind, status: res.status, error: typeof body.error === "string" ? body.error : undefined, body };
}

/** 실패 종류 → 사용자 문구. 4xx 는 서버가 준 메시지를 우선한다. */
export const errText = (f: ReqFail, t: T) =>
  f.kind === "network" ? t("apply.errNetwork")
    : f.kind === "ratelimit" ? t("apply.errRateLimit")
      : f.kind === "server" ? t("apply.errServer")
        : f.error ?? t("apply.genericError");

/** 재전송 방지 키. crypto.randomUUID 가 없는 환경(비보안 컨텍스트)도 대비. */
export const newIdemKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

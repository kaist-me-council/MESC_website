/**
 * 반팔티 1차 구매 확인 — 서버 전용 상수·식별 해시.
 *
 * 학번은 민감정보: DB 에는 sha256(salt:sid:학번) 만 저장하고 원문은 어디에도 남기지 않는다.
 */
import { createHash } from "node:crypto";
import { getAnonSalt } from "@/lib/anon";
import type { Item, Size } from "@/lib/tshirt-parse";

export { SIZES } from "@/lib/tshirt-parse";
export type { Item, Size, Color } from "@/lib/tshirt-parse";

/** 회신 마감 (KST 2026-09-13 23:59:59). ponytail: 상수 — 2단계 ShopSettings 로 옮길 것 */
export const CHECK_DEADLINE = new Date("2026-09-13T23:59:59+09:00");
export const isDeadlinePassed = () => Date.now() > CHECK_DEADLINE.getTime();

/** 못 받은 항목에 대한 본인 선택 */
export interface Resolution extends Item {
  choice: "pickup" | "refund" | "exchange";
  exchangeSize?: Size;
}

export function studentIdHash(studentId: string): string {
  const norm = studentId.replace(/\D/g, "");
  return createHash("sha256").update(`${getAnonSalt()}:sid:${norm}`).digest("hex").slice(0, 32);
}

/** 공개 응답용 — 연락처·해시 제외 */
export function publicRecord(r: {
  id: number; affiliation: string; name: string; items: string; pickedUp: boolean; memo: string | null;
  response: string | null; resolution: string | null; responseNote: string | null; respondedAt: Date | null;
}) {
  return {
    id: r.id,
    affiliation: r.affiliation,
    name: r.name,
    items: JSON.parse(r.items) as Item[],
    pickedUp: r.pickedUp,
    memo: r.memo,
    response: r.response,
    resolution: r.resolution ? (JSON.parse(r.resolution) as Resolution[]) : null,
    responseNote: r.responseNote,
    respondedAt: r.respondedAt,
    deadline: CHECK_DEADLINE.toISOString(),
    deadlinePassed: isDeadlinePassed(),
  };
}

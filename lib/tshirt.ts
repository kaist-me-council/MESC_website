/**
 * 학번 식별 해시 — 서버 전용.
 * 학번은 민감정보: DB 에는 sha256(salt:sid:학번) 만 저장하고 원문은 어디에도 남기지 않는다.
 * (배부 시트 파서는 lib/tshirt-parse.ts)
 */
import { createHash } from "node:crypto";
import { getAnonSalt } from "@/lib/anon";

export function studentIdHash(studentId: string): string {
  const norm = studentId.replace(/\D/g, "");
  return createHash("sha256").update(`${getAnonSalt()}:sid:${norm}`).digest("hex").slice(0, 32);
}

/**
 * 익명 사용자 식별 태그 생성.
 *
 * 같은 IP 가 같은 게시글 안에서 댓글을 달면 동일 태그가 부여되어 흐름 추적 가능.
 * 다른 게시글에서는 다른 태그 → IP 직접 노출 방지.
 *
 * 형식: "익명#a3f9" (앞 4자리 hex)
 *
 * salt 는 환경변수 ANON_SALT. 프로덕션에서 미설정이면 실패(공개 저장소라 fallback 값은 비밀이 아님).
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const DEV_FALLBACK_SALT = "dev-only-anon-salt";

export function getAnonSalt(): string {
  const salt = process.env.ANON_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ANON_SALT 미설정 — Vercel 환경변수에 설정하세요 (openssl rand -hex 32)");
  }
  return DEV_FALLBACK_SALT;
}

/**
 * IP + scope(예: postId) 로부터 4자리 hex 태그 + "익명#" prefix.
 */
export function authorTag(ip: string, scope: string | number = "global"): string {
  const salt = getAnonSalt();
  const digest = createHash("sha256").update(`${salt}:${ip}:${scope}`).digest("hex");
  return `익명#${digest.slice(0, 4)}`;
}

/** IP 해시 (Report 등 차단용 — 직접 IP 저장 대신 비교 가능한 단방향 해시) */
export function ipHash(ip: string): string {
  const salt = getAnonSalt();
  return createHash("sha256").update(`${salt}:ip:${ip}`).digest("hex").slice(0, 16);
}

/** 비밀번호 해시 "saltHex:hashHex" (scrypt 64바이트, 레코드별 salt). AdminAccount·CourseReview 공용. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** 평문 비밀번호가 저장된 해시와 일치하는지 상수 시간으로 비교. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

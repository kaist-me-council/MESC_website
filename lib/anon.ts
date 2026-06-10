/**
 * 익명 사용자 식별 태그 생성.
 *
 * 같은 IP 가 같은 게시글 안에서 댓글을 달면 동일 태그가 부여되어 흐름 추적 가능.
 * 다른 게시글에서는 다른 태그 → IP 직접 노출 방지.
 *
 * 형식: "익명#a3f9" (앞 4자리 hex)
 *
 * salt 는 환경변수 ANON_SALT (없으면 fallback) 로부터 가져온다.
 */

import { createHash } from "node:crypto";

const FALLBACK_SALT = "mesc-anon-salt-please-set-ANON_SALT";

let warnedMissingSalt = false;

export function getAnonSalt(): string {
  const salt = process.env.ANON_SALT;
  if (salt) return salt;
  // 프로덕션에서 하드코딩 fallback salt 사용은 익명성 보장을 약화시킨다.
  // 게시판을 중단시키진 않되(가용성 우선), 1회 경고 로그로 운영자에게 알린다.
  if (process.env.NODE_ENV === "production" && !warnedMissingSalt) {
    warnedMissingSalt = true;
    console.warn(
      "[anon] ANON_SALT 미설정 — 추측 가능한 fallback salt 사용 중. " +
        "익명성 보장을 위해 Vercel 환경변수에 ANON_SALT 를 설정하세요 (openssl rand -hex 32)."
    );
  }
  return FALLBACK_SALT;
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

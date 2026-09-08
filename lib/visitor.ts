/**
 * 방문자 식별 토큰 (서버 전용).
 *
 * 조회수 중복 제거·좋아요 1인 1표에 쓴다. 콘텐츠마다 쿠키를 굽지 않고
 * 브라우저당 랜덤 토큰 쿠키 1개만 두고, 중복 판정은 서버(ContentView·PostLike)가 한다.
 * 토큰 원문은 DB 에 저장하지 않고 scope 별 해시만 저장한다.
 *
 * 토큰을 새로 만드는 곳은 /api/visitor 하나뿐이다. 조회·좋아요가 각자 만들면
 * 쿠키 없는 병렬 요청이 서로 다른 토큰을 굽고 Set-Cookie 가 덮어써서
 * 진 쪽 기록이 고아가 된다. 다른 라우트는 readVisitorToken 으로 읽기만 한다.
 */

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { getAnonSalt } from "@/lib/anon";

const COOKIE = "mesc_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;
const TOKEN_RE = /^[a-f0-9]{32}$/;

/** 읽기 전용 — 서버 컴포넌트에서도 안전. 없으면 null. */
export async function readVisitorToken(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  return raw && TOKEN_RE.test(raw) ? raw : null;
}

/** 새 토큰 발급. /api/visitor 전용 — 다른 곳에서 부르면 V1 경합이 되살아난다. */
export function mintVisitorToken(): string {
  return randomBytes(16).toString("hex");
}

export function attachVisitorCookie<T extends NextResponse>(res: T, token: string, isNew: boolean): T {
  if (isNew) {
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }
  return res;
}

/** scope 별 단방향 해시 (조회수와 좋아요가 같은 값을 공유하지 않도록 분리) */
export function visitorHash(token: string, scope: string): string {
  return createHash("sha256").update(`${getAnonSalt()}:vid:${scope}:${token}`).digest("hex").slice(0, 24);
}

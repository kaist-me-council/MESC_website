/**
 * 방문자 식별 토큰 (서버 전용).
 *
 * 조회수 중복 제거·좋아요 1인 1표에 쓴다. 콘텐츠마다 쿠키를 굽지 않고
 * 브라우저당 랜덤 토큰 쿠키 1개만 두고, 중복 판정은 서버(ContentView·PostLike)가 한다.
 * 토큰 원문은 DB 에 저장하지 않고 scope 별 해시만 저장한다.
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

/** 라우트 핸들러용. 없으면 새로 만들고 isNew=true → attachVisitorCookie 로 응답에 붙일 것. */
export async function getOrCreateVisitorToken(): Promise<{ token: string; isNew: boolean }> {
  const existing = await readVisitorToken();
  if (existing) return { token: existing, isNew: false };
  return { token: randomBytes(16).toString("hex"), isNew: true };
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

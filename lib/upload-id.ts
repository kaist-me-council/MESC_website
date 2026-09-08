/**
 * 청크 업로드 티켓 서명.
 *
 * 브라우저는 구글 드라이브 세션 URI 를 직접 알 필요가 없고, 알아서도 안 된다.
 * 서버가 세션 정보를 서명한 문자열(uploadId)로 바꿔 주고, 청크마다 그것을 되돌려받아 검증한다.
 * 위조하면 서명이 깨지고, 오래된 티켓은 만료로 걸린다.
 *
 * secret 을 인자로 받는다 — 환경변수 없이도 단위 테스트할 수 있게.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface UploadTicket {
  /** 구글 resumable 세션 URI */
  u: string;
  /** 원본 파일명 */
  n: string;
  /** 선언된 전체 크기 */
  s: number;
  /** 확장자로 정한 MIME */
  m: string;
  /** 만료 시각(epoch ms) */
  e: number;
}

/** 세션 URI 는 구글 업로드 호스트만 허용한다. */
const GOOGLE_UPLOAD = /^https:\/\/[a-z0-9.-]*googleapis\.com\//i;

const b64u = (b: Buffer) => b.toString("base64url");
const mac = (body: string, secret: string) => b64u(createHmac("sha256", secret).update(body).digest());

export function signUploadId(ticket: UploadTicket, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify(ticket), "utf8"));
  return `${body}.${mac(body, secret)}`;
}

/** 서명·만료·형식이 모두 맞을 때만 티켓을 돌려준다. 아니면 null. */
export function verifyUploadId(id: unknown, secret: string, now = Date.now()): UploadTicket | null {
  if (typeof id !== "string" || id.length > 4096) return null;
  const dot = id.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = id.slice(0, dot);
  const sig = id.slice(dot + 1);

  const expected = mac(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let t: UploadTicket;
  try {
    t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UploadTicket;
  } catch {
    return null;
  }
  if (typeof t?.u !== "string" || !GOOGLE_UPLOAD.test(t.u)) return null;
  if (typeof t.n !== "string" || typeof t.m !== "string") return null;
  if (!Number.isInteger(t.s) || t.s <= 0) return null;
  if (!Number.isFinite(t.e) || t.e < now) return null;
  return t;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";

// 공개: 웹 푸시 구독 등록·해제. 로그인 없이 브라우저 단위로 구독한다.
// 개인정보는 저장하지 않는다(엔드포인트·공개키·user-agent 만).

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, ...noStore });

interface Parsed {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** 표준 PushSubscription JSON 형태만 받는다. */
function parse(b: Record<string, unknown>): Parsed | null {
  const endpoint = typeof b.endpoint === "string" ? b.endpoint.trim() : "";
  if (!endpoint || endpoint.length > 1000 || !/^https:\/\//.test(endpoint)) return null;
  const keys = (b.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!p256dh || p256dh.length > 300 || !auth || auth.length > 300) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(req: Request) {
  if (!enforce(getClientIp(req), "push-sub", 20, 60_000).ok) {
    return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const parsed = parse(b);
  if (!parsed) return bad("구독 정보 형식이 올바르지 않습니다.");

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    update: { p256dh: parsed.p256dh, auth: parsed.auth, userAgent, failCount: 0 },
    create: { ...parsed, userAgent },
  });

  return NextResponse.json({ ok: true }, noStore);
}

export async function DELETE(req: Request) {
  if (!enforce(getClientIp(req), "push-sub", 20, 60_000).ok) {
    return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const endpoint = typeof b.endpoint === "string" ? b.endpoint.trim() : "";
  if (!endpoint) return bad("endpoint 가 필요합니다.");

  const { count } = await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true, removed: count }, noStore);
}

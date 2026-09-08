import { NextResponse } from "next/server";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { attachVisitorCookie, mintVisitorToken, readVisitorToken } from "@/lib/visitor";

// 방문자 쿠키를 확정하는 유일한 지점. 조회·좋아요는 여기서 확정된 쿠키를 읽기만 한다.
// 멱등: 이미 쿠키가 있으면 새로 만들지 않는다. 그래서 두 탭이 동시에 들어와도
// (클라이언트가 Web Locks 로 직렬화한 뒤) 두 번째 요청은 첫 번째가 구운 쿠키를 그대로 쓴다.
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function POST(req: Request) {
  if (!enforce(getClientIp(req), "visitor", 60, 60_000).ok)
    return NextResponse.json({ ok: false }, { status: 429, ...noStore });

  const existing = await readVisitorToken();
  if (existing) return NextResponse.json({ ok: true, created: false }, noStore);

  return attachVisitorCookie(NextResponse.json({ ok: true, created: true }, noStore), mintVisitorToken(), true);
}

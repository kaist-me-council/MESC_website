import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendPushToEndpoint } from "@/lib/push";

// 관리자 시험 발송 — **요청을 보낸 이 기기에만** 보낸다.
// 전체 발송은 공지 등록 시의 notify 또는 목록의 "알림" 버튼으로만 일어난다.

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json(
      { error: "이 기기의 알림 구독을 찾지 못했습니다. 먼저 '공지 알림 받기'를 켜주세요." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const result = await sendPushToEndpoint(endpoint, {
    title: "알림 테스트",
    body: "기계공학과 학생회 알림이 정상적으로 도착했습니다.",
    url: "/",
  });

  // endpoint 는 개인 기기 식별자다 — 감사 로그에 원문을 남기지 않는다.
  await audit(session.user?.name ?? "unknown", "push.test", "push:self", `status=${result.status}`);

  const status = result.status === "not_configured" || result.status === "lookup_failed" ? 503 : 200;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "private, no-store" } });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendPushToAll } from "@/lib/push";

// 관리자: 구독한 모든 브라우저에 테스트 알림을 보낸다(공지를 올리지 않고 확인용).

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendPushToAll({
    title: "알림 테스트",
    body: "기계공학과 학생회 알림이 정상적으로 도착했습니다.",
    url: "/",
  });

  await audit(
    session.user?.name ?? "unknown",
    "push.test",
    "push:all",
    `sent=${result.sent} failed=${result.failed} pruned=${result.pruned}`
  );

  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

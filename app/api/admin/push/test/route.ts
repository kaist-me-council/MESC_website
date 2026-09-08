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
    `status=${result.status} sent=${result.sent} failed=${result.failed} pruned=${result.pruned}`
  );

  // 설정 미비·조회 실패는 성공한 0건과 다르다 — 관리자가 조치할 수 있게 503 으로 구분한다.
  const status = result.status === "not_configured" || result.status === "lookup_failed" ? 503 : 200;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "private, no-store" } });
}

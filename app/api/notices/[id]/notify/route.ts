import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { sendPushToAll } from "@/lib/push";

// 관리자: 이미 등록된 공지에 대해 알림을 보낸다(등록 시 알림을 끄고 올렸다가 나중에 보낼 때).

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const notice = await prisma.notice.findUnique({
    where: { id: numId },
    select: { id: true, title: true },
  });
  if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await sendPushToAll({
    title: "새 공지",
    body: notice.title,
    url: `/notices/${notice.id}`,
  });

  await audit(
    session.user?.name ?? "unknown",
    "notice.notify",
    `notice:${notice.id}`,
    `sent=${result.sent} failed=${result.failed} pruned=${result.pruned}`
  );

  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

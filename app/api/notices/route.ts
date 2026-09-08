import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isValidString, isAllowedCategory, parseAttachments } from "@/lib/validation";
import { sendPushToAll } from "@/lib/push";
import { withDownloadUrls } from "@/lib/upload-rules";

const ALLOWED_CATEGORIES = ["공지", "행사", "학사"];

export async function GET() {
  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { attachments: { orderBy: { id: "asc" } } },
  });
  return NextResponse.json(notices.map(withDownloadUrls));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (!isValidString(b.title, 200)) {
    return NextResponse.json({ error: "제목은 1~200자 이내여야 합니다." }, { status: 400 });
  }
  if (!isValidString(b.content, 10000)) {
    return NextResponse.json({ error: "내용은 1~10000자 이내여야 합니다." }, { status: 400 });
  }

  const category = isAllowedCategory(b.category, ALLOWED_CATEGORIES) ? b.category : "공지";

  const notice = await prisma.notice.create({
    data: {
      title: b.title.trim(),
      titleEn: typeof b.titleEn === "string" ? b.titleEn.trim().slice(0, 200) || null : null,
      content: b.content.trim(),
      contentEn: typeof b.contentEn === "string" ? b.contentEn.trim().slice(0, 10000) || null : null,
      category,
      pinned: Boolean(b.pinned),
      // 새 공지에는 기존 첨부 id 가 있을 수 없다 — id 가 붙은 항목은 버리고 id 는 떼고 만든다.
      attachments: {
        create: parseAttachments(b.attachments)
          .filter((a) => a.id === null)
          .map((a) => ({ name: a.name, url: a.url, driveFileId: a.driveFileId, size: a.size, mime: a.mime })),
      },
    },
    include: { attachments: { orderBy: { id: "asc" } } },
  });
  // notify:true 면 구독한 브라우저에 푸시. 서버리스에서는 응답 후 작업이 종료될 수 있어
  // await 로 끝까지 보낸다. sendPushToAll 은 스스로 throw 하지 않지만 방어적으로 감싼다.
  //
  // 공지 저장 결과와 알림 결과는 별도 필드로 돌려준다. 알림이 실패해도 공지는 저장된 것이고,
  // 재시도는 공지를 다시 만드는 것이 아니라 POST /api/notices/<id>/notify 로 알림만 다시 보낸다.
  let notified: Awaited<ReturnType<typeof sendPushToAll>> | null = null;
  if (b.notify === true) {
    try {
      notified = await sendPushToAll({ title: "새 공지", body: notice.title, url: `/notices/${notice.id}` });
    } catch (e) {
      console.error("[notice] 알림 발송 실패", e instanceof Error ? e.message : e);
      notified = { status: "partial", sent: 0, failed: 0, pruned: 0 };
    }
  }
  revalidatePath("/");
  return NextResponse.json({ ...withDownloadUrls(notice), notified });
}

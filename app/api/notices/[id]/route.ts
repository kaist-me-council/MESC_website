import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { isValidString, isAllowedCategory, parseId, parseAttachments } from "@/lib/validation";
import { withDownloadUrls } from "@/lib/upload-rules";
import { deleteFile, getAccessTokenOrNull } from "@/lib/drive-oauth";

const ALLOWED_CATEGORIES = ["공지", "행사", "학사"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const notice = await prisma.notice.findUnique({ where: { id: numId }, include: { attachments: { orderBy: { id: "asc" } } } });
  if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(withDownloadUrls(notice));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

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

  // 첨부는 전체 교체 — 화면이 보내온 목록이 최종 상태다.
  const attachments = parseAttachments(b.attachments);
  const notice = await prisma.notice.update({
    where: { id: numId },
    data: {
      title: (b.title as string).trim(),
      titleEn: typeof b.titleEn === "string" ? b.titleEn.trim().slice(0, 200) || null : null,
      content: (b.content as string).trim(),
      contentEn: typeof b.contentEn === "string" ? b.contentEn.trim().slice(0, 10000) || null : null,
      category,
      pinned: Boolean(b.pinned),
      attachments: { deleteMany: {}, create: attachments },
    },
    include: { attachments: { orderBy: { id: "asc" } } },
  });
  revalidatePath("/");
  return NextResponse.json(withDownloadUrls(notice));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  // 먼저 저장된 파일을 정리한다. 실패해도 공지 삭제는 진행 (고아 파일은 무해).
  const files = await prisma.noticeAttachment.findMany({ where: { noticeId: numId }, select: { url: true, driveFileId: true } });
  const blobUrls = files.filter((f) => !f.driveFileId && f.url).map((f) => f.url);
  if (blobUrls.length) {
    try { await del(blobUrls); } catch { /* blob 정리 실패는 무시 */ }
  }
  const driveIds = files.map((f) => f.driveFileId).filter((v): v is string => !!v);
  if (driveIds.length) {
    const tok = await getAccessTokenOrNull().catch(() => null);
    if (tok) await Promise.all(driveIds.map((fid) => deleteFile(tok.accessToken, fid)));
  }

  const { count } = await prisma.notice.deleteMany({ where: { id: numId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit(session.user?.name ?? "unknown", "notice.delete", `notice:${numId}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { isValidString, isAllowedCategory, parseId, parseAttachments } from "@/lib/validation";
import { withDownloadUrls, diffAttachments } from "@/lib/upload-rules";
import { deleteFile, getAccessTokenOrNull } from "@/lib/drive-oauth";

const ALLOWED_CATEGORIES = ["공지", "행사", "학사"];

/**
 * 더 이상 참조되지 않는 실파일만 지운다.
 * 같은 파일을 다른 공지가 아직 가리키고 있으면 건드리지 않는다.
 * 정리 실패는 저장 성공을 뒤집지 않는다 — 고아 파일은 무해하고, 잘못 지우면 복구가 안 된다.
 */
async function cleanupFiles(rows: { id: number; url: string; driveFileId: string | null }[]) {
  const blobUrls: string[] = [];
  const driveIds: string[] = [];
  for (const r of rows) {
    if (r.driveFileId) {
      const others = await prisma.noticeAttachment.count({ where: { driveFileId: r.driveFileId } });
      if (others === 0) driveIds.push(r.driveFileId);
    } else if (r.url) {
      const others = await prisma.noticeAttachment.count({ where: { url: r.url } });
      if (others === 0) blobUrls.push(r.url);
    }
  }
  if (blobUrls.length) await del(blobUrls).catch((e) => console.error("[cleanup blob]", e));
  if (driveIds.length) {
    const tok = await getAccessTokenOrNull().catch(() => null);
    if (tok) await Promise.all(driveIds.map((fid) => deleteFile(tok.accessToken, fid).catch((e) => console.error("[cleanup drive]", e))));
  }
}

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

  const noticeData = {
    title: (b.title as string).trim(),
    titleEn: typeof b.titleEn === "string" ? b.titleEn.trim().slice(0, 200) || null : null,
    content: (b.content as string).trim(),
    contentEn: typeof b.contentEn === "string" ? b.contentEn.trim().slice(0, 10000) || null : null,
    category,
    pinned: Boolean(b.pinned),
  };

  // 첨부 계약: 키가 없으면 변경 없음, 명시적 [] 는 전체 제거.
  // 유지되는 행은 id 를 그대로 둔다 — id 가 바뀌면 학생이 이미 받은 다운로드 주소가 죽는다.
  if (!("attachments" in b)) {
    const notice = await prisma.notice.update({
      where: { id: numId },
      data: noticeData,
      include: { attachments: { orderBy: { id: "asc" } } },
    });
    revalidatePath("/");
    return NextResponse.json(withDownloadUrls(notice));
  }

  const existing = await prisma.noticeAttachment.findMany({
    where: { noticeId: numId },
    select: { id: true, url: true, driveFileId: true },
  });
  const diff = diffAttachments(existing, parseAttachments(b.attachments));
  if (diff.foreignIds.length)
    return NextResponse.json({ error: "이 공지의 첨부가 아닌 항목이 포함돼 있습니다." }, { status: 400 });

  // 본문과 첨부 변경을 한 트랜잭션으로 묶는다. 실패하면 아무것도 바뀌지 않는다.
  const [, , , notice] = await prisma.$transaction([
    prisma.notice.update({ where: { id: numId }, data: noticeData }),
    prisma.noticeAttachment.deleteMany({ where: { id: { in: diff.toDeleteIds }, noticeId: numId } }),
    prisma.noticeAttachment.createMany({ data: diff.toCreate.map((a) => ({ ...a, noticeId: numId })) }),
    prisma.notice.findUniqueOrThrow({ where: { id: numId }, include: { attachments: { orderBy: { id: "asc" } } } }),
  ]);

  // 실파일 정리는 DB 커밋이 끝난 뒤에만. 실패해도 저장은 성공으로 둔다(고아 파일은 무해).
  const removed = existing.filter((e) => diff.toDeleteIds.includes(e.id));
  if (removed.length) void cleanupFiles(removed).catch((e) => console.error("[notice attachments cleanup]", e));

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

  const files = await prisma.noticeAttachment.findMany({
    where: { noticeId: numId },
    select: { id: true, url: true, driveFileId: true },
  });

  const { count } = await prisma.notice.deleteMany({ where: { id: numId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 행이 사라진 뒤에 정리해야 "다른 공지가 아직 쓰는지" 판정이 맞는다.
  if (files.length) await cleanupFiles(files).catch((e) => console.error("[notice delete cleanup]", e));
  await audit(session.user?.name ?? "unknown", "notice.delete", `notice:${numId}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

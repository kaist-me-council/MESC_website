import { NextResponse } from "next/server";
import { isAllowedImageUrl, IMAGE_HOST_ERROR } from "@/lib/image-hosts";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString } from "@/lib/validation";
import { createFolder, getAccessTokenOrNull, makePublic } from "@/lib/drive-oauth";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: { photos: { orderBy: { order: "asc" } }, _count: { select: { feedbacks: true } } },
  });
  return NextResponse.json(events);
}

function formatFolderName(title: string, date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}-${title}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const coverImage = typeof body.coverImage === "string" ? body.coverImage.trim() : "";
  if (coverImage && !isAllowedImageUrl(coverImage)) return NextResponse.json({ error: IMAGE_HOST_ERROR }, { status: 400 });

  if (!isValidString(title, 100)) return NextResponse.json({ error: "행사명을 입력해주세요." }, { status: 400 });
  if (!date) return NextResponse.json({ error: "날짜를 입력해주세요." }, { status: 400 });

  const eventDate = new Date(date);

  // Drive 가 연결되어 있고 부모 폴더가 설정되어 있으면 자동으로 행사 폴더 생성
  let driveFolderId: string | null = null;
  let driveWarning: string | null = null;
  try {
    const tok = await getAccessTokenOrNull();
    if (tok?.auth.parentFolderId) {
      const folderName = formatFolderName(title, eventDate);
      const folder = await createFolder(tok.accessToken, folderName, tok.auth.parentFolderId);
      // 폴더 자체를 "링크 있는 모든 사용자가 보기" 로 공개 → 안의 파일도 자동 상속되어 lh3 썸네일 동작
      await makePublic(tok.accessToken, folder.id);
      driveFolderId = folder.id;
    }
  } catch (err) {
    driveWarning = err instanceof Error ? err.message : "Drive 폴더 자동 생성 실패";
    console.warn("[events POST] Drive 폴더 생성 실패:", err);
  }

  const event = await prisma.event.create({
    data: {
      title,
      date: eventDate,
      description: description || null,
      coverImage: coverImage || null,
      driveFolderId,
      lastSyncedAt: driveFolderId ? new Date() : null,
    },
  });

  return NextResponse.json({ ...event, driveWarning }, { status: 201 });
}

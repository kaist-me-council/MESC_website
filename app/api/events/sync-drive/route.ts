import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  DriveError,
  driveImageUrl,
  fetchDriveFolder,
  parseFolderInput,
  parseFolderName,
} from "@/lib/drive";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { folderUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const folderId = parseFolderInput(body.folderUrl ?? "");
  if (!folderId) {
    return NextResponse.json(
      { error: "올바른 Google Drive 폴더 URL을 입력해주세요." },
      { status: 400 },
    );
  }

  try {
    const { folderName, files } = await fetchDriveFolder(folderId);

    const parsed = parseFolderName(folderName);
    if (!parsed) {
      return NextResponse.json(
        {
          error: `폴더명 "${folderName}" 을(를) 인식할 수 없습니다. 'YYYY-MM-DD-행사명' 형식으로 만들어주세요.`,
        },
        { status: 400 },
      );
    }

    const existing = await prisma.event.findUnique({ where: { driveFolderId: folderId } });
    const event = existing
      ? await prisma.event.update({
          where: { id: existing.id },
          data: { title: parsed.title, date: parsed.date, lastSyncedAt: new Date() },
        })
      : await prisma.event.create({
          data: {
            title: parsed.title,
            date: parsed.date,
            driveFolderId: folderId,
            lastSyncedAt: new Date(),
          },
        });

    const existingFileIds = new Set(
      (
        await prisma.eventPhoto.findMany({
          where: { eventId: event.id, driveFileId: { not: null } },
          select: { driveFileId: true },
        })
      ).map((p) => p.driveFileId as string),
    );

    let added = 0;
    let skipped = 0;
    let order = await prisma.eventPhoto.count({ where: { eventId: event.id } });

    for (const file of files) {
      if (existingFileIds.has(file.id)) {
        skipped++;
        continue;
      }
      await prisma.eventPhoto.create({
        data: {
          eventId: event.id,
          imageUrl: driveImageUrl(file.id),
          caption: file.name,
          order: order++,
          source: "drive",
          driveFileId: file.id,
        },
      });
      added++;
    }

    return NextResponse.json({
      eventId: event.id,
      title: event.title,
      added,
      skipped,
      totalFiles: files.length,
    });
  } catch (err) {
    if (err instanceof DriveError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[sync-drive] unexpected error:", err);
    return NextResponse.json({ error: "동기화 중 오류가 발생했습니다." }, { status: 500 });
  }
}

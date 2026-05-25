import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { DriveError, driveImageUrl, fetchDriveFolder } from "@/lib/drive";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "행사를 찾을 수 없습니다." }, { status: 404 });
  if (!event.driveFolderId) {
    return NextResponse.json(
      { error: "이 행사는 Drive 폴더와 연결되어 있지 않습니다." },
      { status: 400 },
    );
  }

  try {
    const { files } = await fetchDriveFolder(event.driveFolderId);

    const existingFileIds = new Set(
      (
        await prisma.eventPhoto.findMany({
          where: { eventId: id, driveFileId: { not: null } },
          select: { driveFileId: true },
        })
      ).map((p) => p.driveFileId as string),
    );

    let added = 0;
    let skipped = 0;
    let order = await prisma.eventPhoto.count({ where: { eventId: id } });

    for (const file of files) {
      if (existingFileIds.has(file.id)) {
        skipped++;
        continue;
      }
      await prisma.eventPhoto.create({
        data: {
          eventId: id,
          imageUrl: driveImageUrl(file.id),
          caption: file.name,
          order: order++,
          source: "drive",
          driveFileId: file.id,
        },
      });
      added++;
    }

    await prisma.event.update({ where: { id }, data: { lastSyncedAt: new Date() } });

    return NextResponse.json({ added, skipped, totalFiles: files.length });
  } catch (err) {
    if (err instanceof DriveError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[resync] unexpected error:", err);
    return NextResponse.json({ error: "재동기화 중 오류가 발생했습니다." }, { status: 500 });
  }
}

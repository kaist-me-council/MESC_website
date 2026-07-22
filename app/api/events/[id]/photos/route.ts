import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import { parseId } from "@/lib/validation";
import { getAccessTokenOrNull, uploadFile, makePublic } from "@/lib/drive-oauth";
import { driveImageUrl } from "@/lib/drive";
import { eventPhotoFilename } from "@/lib/filename";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 25 * 1024 * 1024; // 25MB (Drive 업로드 고려해 상향)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string | null;

  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "파일 크기는 25MB 이하여야 합니다." }, { status: 400 });

  // 행사가 Drive 폴더와 연결돼 있으면 Drive 로 업로드, 아니면 Vercel Blob 으로 fallback
  const event = await prisma.event.findUnique({
    where: { id },
    select: { driveFolderId: true, coverImage: true, title: true, date: true },
  });
  if (!event) return NextResponse.json({ error: "행사를 찾을 수 없습니다." }, { status: 404 });

  const existingCount = await prisma.eventPhoto.count({ where: { eventId: id } });
  const isFirstPhoto = existingCount === 0;

  let imageUrl: string;
  let extra: { source: string; driveFileId?: string };

  if (event.driveFolderId) {
    const tok = await getAccessTokenOrNull();
    if (!tok) {
      return NextResponse.json(
        { error: "Drive 연결이 끊겼습니다. 관리자 페이지에서 다시 인증해주세요." },
        { status: 401 },
      );
    }
    // 파일명 자동 변환: "YYYY-MM-DD-행사명 (NNN).ext"
    const newName = eventPhotoFilename(event.date, event.title, existingCount + 1, file.name);
    const renamed = new File([await file.arrayBuffer()], newName, { type: file.type });
    const uploaded = await uploadFile(tok.accessToken, renamed, event.driveFolderId);
    // 폴더가 이미 public 이라 파일은 자동 상속. 안전을 위해 한 번 더 명시.
    await makePublic(tok.accessToken, uploaded.id).catch(() => {});
    imageUrl = driveImageUrl(uploaded.id);
    extra = { source: "drive", driveFileId: uploaded.id };
  } else {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`events/${id}/${Date.now()}-${safeName}`, file, { access: "public" });
    imageUrl = blob.url;
    extra = { source: "blob" };
  }

  const photo = await prisma.eventPhoto.create({
    data: {
      eventId: id,
      imageUrl,
      caption: caption ?? (extra.source === "drive" ? file.name : null),
      order: existingCount,
      ...extra,
    },
  });

  // 첫 사진이고 대표 사진이 비어있으면 자동으로 대표 사진 설정
  if (isFirstPhoto && !event.coverImage) {
    await prisma.event.update({ where: { id }, data: { coverImage: imageUrl } });
  }

  return NextResponse.json(photo, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const eventId = parseId(idStr);
  if (!eventId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { photoId } = await req.json();
  const pid = parseId(String(photoId));
  if (!pid) return NextResponse.json({ error: "Invalid photo ID" }, { status: 400 });

  const { count } = await prisma.eventPhoto.deleteMany({ where: { id: pid, eventId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

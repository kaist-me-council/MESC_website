import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import { parseId } from "@/lib/validation";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await put(`events/${id}/${Date.now()}-${safeName}`, file, { access: "public" });

  const existingCount = await prisma.eventPhoto.count({ where: { eventId: id } });
  const photo = await prisma.eventPhoto.create({
    data: { eventId: id, imageUrl: blob.url, caption: caption ?? null, order: existingCount },
  });
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

  await prisma.eventPhoto.delete({ where: { id: pid, eventId } });
  return NextResponse.json({ ok: true });
}

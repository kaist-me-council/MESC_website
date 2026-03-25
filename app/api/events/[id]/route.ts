import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, parseId } from "@/lib/validation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { order: "asc" } },
      feedbacks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" ? body.date : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const coverImage = typeof body.coverImage === "string" ? body.coverImage.trim() : "";

  if (!isValidString(title, 100)) return NextResponse.json({ error: "행사명을 입력해주세요." }, { status: 400 });

  const event = await prisma.event.update({
    where: { id },
    data: { title, date: new Date(date), description: description || null, coverImage: coverImage || null },
  });
  return NextResponse.json(event);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

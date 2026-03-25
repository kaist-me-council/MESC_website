import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl, isAllowedCategory, parseId } from "@/lib/validation";

const ALLOWED_LEVELS = ["200", "300", "400", "기타"];

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "기타";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const textbook = typeof body.textbook === "string" ? body.textbook.trim() : "";
  const textbookAvailable = body.textbookAvailable === true;
  const youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : "";
  const order = typeof body.order === "number" ? Math.floor(body.order) : 0;

  if (!isValidString(code, 20)) return NextResponse.json({ error: "과목코드를 입력해주세요." }, { status: 400 });
  if (!isValidString(name, 100)) return NextResponse.json({ error: "과목명을 입력해주세요." }, { status: 400 });
  if (!isAllowedCategory(level, ALLOWED_LEVELS)) return NextResponse.json({ error: "올바른 레벨을 선택해주세요." }, { status: 400 });
  if (youtubeUrl && !isValidUrl(youtubeUrl)) return NextResponse.json({ error: "올바른 URL을 입력해주세요." }, { status: 400 });

  const course = await prisma.course.update({
    where: { id },
    data: { code, name, level, description: description || null, textbook: textbook || null, textbookAvailable, youtubeUrl: youtubeUrl || null, order },
  });
  return NextResponse.json(course);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl, isAllowedCategory, parseId } from "@/lib/validation";

const ALLOWED_CATEGORIES = ["200", "300", "400", "기타"];

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
  if (!isValidUrl(String(b.fileUrl ?? ""))) {
    return NextResponse.json({ error: "올바른 파일 URL을 입력해주세요." }, { status: 400 });
  }

  const category = isAllowedCategory(b.category, ALLOWED_CATEGORIES) ? b.category : "기타";
  const courseCode = typeof b.courseCode === "string" && b.courseCode.trim() ? b.courseCode.trim() : null;

  const resource = await prisma.resource.update({
    where: { id: numId },
    data: {
      title: (b.title as string).trim(),
      description: b.description ? String(b.description).trim() : null,
      fileUrl: String(b.fileUrl).trim(),
      category,
      courseCode,
    },
  });
  return NextResponse.json(resource);
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

  await prisma.resource.delete({ where: { id: numId } });
  return NextResponse.json({ ok: true });
}

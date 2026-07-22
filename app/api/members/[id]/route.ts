import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl, parseId } from "@/lib/validation";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { count } = await prisma.member.deleteMany({ where: { id: numId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
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

  if (!isValidString(b.name, 100)) {
    return NextResponse.json({ error: "이름은 1~100자 이내여야 합니다." }, { status: 400 });
  }
  if (!isValidString(b.role, 100)) {
    return NextResponse.json({ error: "직책은 1~100자 이내여야 합니다." }, { status: 400 });
  }
  if (b.imageUrl && b.imageUrl !== "") {
    if (!isValidUrl(String(b.imageUrl))) {
      return NextResponse.json({ error: "올바른 이미지 URL을 입력해주세요." }, { status: 400 });
    }
  }

  const order = typeof b.order === "number" ? Math.floor(b.order) : 0;
  const bureau = typeof b.bureau === "string" ? b.bureau.trim() : "";
  const council = b.council === true;

  const member = await prisma.member.update({
    where: { id: numId },
    data: {
      name: (b.name as string).trim(),
      role: (b.role as string).trim(),
      bureau,
      council,
      imageUrl: b.imageUrl ? String(b.imageUrl) : null,
      order,
    },
  });
  return NextResponse.json(member);
}

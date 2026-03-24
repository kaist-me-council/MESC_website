import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl } from "@/lib/validation";

export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const member = await prisma.member.create({
    data: {
      name: (b.name as string).trim(),
      role: (b.role as string).trim(),
      bureau,
      imageUrl: b.imageUrl ? String(b.imageUrl) : null,
      order,
    },
  });
  return NextResponse.json(member);
}

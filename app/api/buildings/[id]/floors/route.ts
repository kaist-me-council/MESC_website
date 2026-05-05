import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";

// 인증: 새 층 추가 (이미지 URL 포함)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const buildingId = parseId(idStr);
  if (!buildingId) return NextResponse.json({ error: "Invalid building ID" }, { status: 400 });

  const body = await req.json();
  const level = typeof body.level === "number" ? body.level : null;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;

  if (level === null) return NextResponse.json({ error: "층은 필수입니다." }, { status: 400 });

  try {
    const floor = await prisma.buildingFloor.create({
      data: { buildingId, level, imageUrl, description },
    });
    return NextResponse.json(floor, { status: 201 });
  } catch {
    return NextResponse.json({ error: "해당 층이 이미 등록되어 있습니다." }, { status: 400 });
  }
}

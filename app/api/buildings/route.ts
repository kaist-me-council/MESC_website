import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 공개: 전체 건물 + 층 + 교수님
export async function GET() {
  const buildings = await prisma.building.findMany({
    orderBy: { order: "asc" },
    include: {
      floors: {
        orderBy: { level: "asc" },
        include: {
          professors: { orderBy: { roomNumber: "asc" } },
        },
      },
    },
  });
  return NextResponse.json(buildings);
}

// 인증: 신규 건물 추가
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase().slice(0, 10) : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 50) : "";
  const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim().slice(0, 50) || null : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
  const order = typeof body.order === "number" ? body.order : 0;

  if (!code || !name) return NextResponse.json({ error: "코드와 이름은 필수입니다." }, { status: 400 });

  try {
    const building = await prisma.building.create({
      data: { code, name, nameEn, description, order },
    });
    return NextResponse.json(building, { status: 201 });
  } catch {
    return NextResponse.json({ error: "이미 존재하는 건물 코드입니다." }, { status: 400 });
  }
}

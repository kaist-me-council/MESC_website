import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 공개: 전체 교수님 (건물·층 정보 포함)
export async function GET() {
  const professors = await prisma.professor.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      building: { select: { id: true, code: true, name: true } },
      floor: { select: { id: true, level: true } },
    },
  });
  return NextResponse.json(professors);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 50) : "";
  if (!name) return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });

  const data = {
    name,
    nameEn: typeof body.nameEn === "string" ? body.nameEn.trim().slice(0, 50) || null : null,
    title: typeof body.title === "string" ? body.title.trim().slice(0, 30) : "교수",
    buildingId: typeof body.buildingId === "number" ? body.buildingId : null,
    floorId: typeof body.floorId === "number" ? body.floorId : null,
    roomNumber: typeof body.roomNumber === "string" ? body.roomNumber.trim().slice(0, 20) || null : null,
    email: typeof body.email === "string" ? body.email.trim().slice(0, 100) || null : null,
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 30) || null : null,
    researchArea: typeof body.researchArea === "string" ? body.researchArea.trim().slice(0, 200) || null : null,
    websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl.trim() || null : null,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null,
    order: typeof body.order === "number" ? body.order : 0,
  };

  const professor = await prisma.professor.create({ data });
  return NextResponse.json(professor, { status: 201 });
}

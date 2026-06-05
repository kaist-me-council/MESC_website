import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl } from "@/lib/validation";

// 공개: enabled 동아리 (정렬)
export async function GET() {
  const clubs = await prisma.club.findMany({
    where: { enabled: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(clubs);
}

// 인증: 신규 동아리
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const descKo = typeof body.descKo === "string" ? body.descKo.trim().slice(0, 2000) : "";
  if (!name || !descKo) return NextResponse.json({ error: "이름과 설명(한국어)은 필수입니다." }, { status: 400 });

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url && !isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });

  const club = await prisma.club.create({
    data: {
      name,
      nameEn: typeof body.nameEn === "string" ? body.nameEn.trim().slice(0, 60) || null : null,
      tagKo: typeof body.tagKo === "string" ? body.tagKo.trim().slice(0, 40) || null : null,
      tagEn: typeof body.tagEn === "string" ? body.tagEn.trim().slice(0, 40) || null : null,
      descKo,
      descEn: typeof body.descEn === "string" ? body.descEn.trim().slice(0, 2000) || null : null,
      activitiesKo: typeof body.activitiesKo === "string" ? body.activitiesKo.trim().slice(0, 2000) || null : null,
      activitiesEn: typeof body.activitiesEn === "string" ? body.activitiesEn.trim().slice(0, 2000) || null : null,
      url: url || null,
      urlLabel: typeof body.urlLabel === "string" ? body.urlLabel.trim().slice(0, 20) || null : null,
      emoji: typeof body.emoji === "string" ? body.emoji.trim().slice(0, 10) || null : null,
      colorPreset: typeof body.colorPreset === "string" ? body.colorPreset.trim().slice(0, 20) || null : null,
      order: typeof body.order === "number" ? body.order : 0,
      enabled: body.enabled !== false,
    },
  });
  return NextResponse.json(club, { status: 201 });
}

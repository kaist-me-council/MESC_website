import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl } from "@/lib/validation";

// 인증: 전체 링크 목록 (관리자용 - enabled 여부 무관)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await prisma.popupLink.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(links);
}

// 인증: 신규 링크 추가
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 50) : "";
  const labelEn = typeof body.labelEn === "string" ? body.labelEn.trim().slice(0, 50) || null : null;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 20) || null : null;
  const order = typeof body.order === "number" ? body.order : 0;
  const enabled = body.enabled !== false;

  if (!label || !url) return NextResponse.json({ error: "라벨과 URL은 필수입니다." }, { status: 400 });
  if (!isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });

  const link = await prisma.popupLink.create({
    data: { label, labelEn, url, icon, order, enabled },
  });
  return NextResponse.json(link, { status: 201 });
}

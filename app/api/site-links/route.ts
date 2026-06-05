import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl } from "@/lib/validation";
import { LINK_CATEGORIES } from "@/lib/site-settings";

// 공개: enabled 링크. ?category=important|community 로 필터, 없으면 전체.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const where: Record<string, unknown> = { enabled: true };
  if (category && LINK_CATEGORIES.includes(category as never)) where.category = category;
  const links = await prisma.siteLink.findMany({ where, orderBy: { order: "asc" } });
  return NextResponse.json(links);
}

// 인증: 신규 링크
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const category = LINK_CATEGORIES.includes(body.category) ? body.category : "important";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
  const labelEn = typeof body.labelEn === "string" ? body.labelEn.trim().slice(0, 60) || null : null;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 200) || null : null;
  const descriptionEn = typeof body.descriptionEn === "string" ? body.descriptionEn.trim().slice(0, 200) || null : null;
  const icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 20) || null : null;
  const order = typeof body.order === "number" ? Math.max(0, Math.trunc(body.order)) : 0;
  const enabled = body.enabled !== false;

  if (!label || !url) return NextResponse.json({ error: "라벨과 URL은 필수입니다." }, { status: 400 });
  if (!isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });

  const link = await prisma.siteLink.create({
    data: { category, label, labelEn, url, description, descriptionEn, icon, order, enabled },
  });
  return NextResponse.json(link, { status: 201 });
}

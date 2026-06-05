import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl, parseId } from "@/lib/validation";
import { LINK_CATEGORIES } from "@/lib/site-settings";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (LINK_CATEGORIES.includes(body.category)) data.category = body.category;
  if (typeof body.label === "string") data.label = body.label.trim().slice(0, 60);
  if (typeof body.labelEn === "string") data.labelEn = body.labelEn.trim().slice(0, 60) || null;
  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (!isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    data.url = url;
  }
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 200) || null;
  if (typeof body.descriptionEn === "string") data.descriptionEn = body.descriptionEn.trim().slice(0, 200) || null;
  if (typeof body.icon === "string") data.icon = body.icon.trim().slice(0, 20) || null;
  if (typeof body.order === "number") data.order = body.order;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  const link = await prisma.siteLink.update({ where: { id }, data });
  return NextResponse.json(link);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  await prisma.siteLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

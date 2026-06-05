import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidUrl, parseId } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
  if (typeof body.nameEn === "string") data.nameEn = body.nameEn.trim().slice(0, 60) || null;
  if (typeof body.tagKo === "string") data.tagKo = body.tagKo.trim().slice(0, 40) || null;
  if (typeof body.tagEn === "string") data.tagEn = body.tagEn.trim().slice(0, 40) || null;
  if (typeof body.descKo === "string") data.descKo = body.descKo.trim().slice(0, 2000);
  if (typeof body.descEn === "string") data.descEn = body.descEn.trim().slice(0, 2000) || null;
  if (typeof body.activitiesKo === "string") data.activitiesKo = body.activitiesKo.trim().slice(0, 2000) || null;
  if (typeof body.activitiesEn === "string") data.activitiesEn = body.activitiesEn.trim().slice(0, 2000) || null;
  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (url && !isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    data.url = url || null;
  }
  if (typeof body.urlLabel === "string") data.urlLabel = body.urlLabel.trim().slice(0, 20) || null;
  if (typeof body.emoji === "string") data.emoji = body.emoji.trim().slice(0, 10) || null;
  if (typeof body.colorPreset === "string") data.colorPreset = body.colorPreset.trim().slice(0, 20) || null;
  if (typeof body.order === "number") data.order = Math.max(0, Math.trunc(body.order));
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  const club = await prisma.club.update({ where: { id }, data });
  return NextResponse.json(club);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  await prisma.club.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

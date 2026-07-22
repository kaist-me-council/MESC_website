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

  if (typeof body.label === "string") data.label = body.label.trim().slice(0, 50);
  if (typeof body.labelEn === "string") data.labelEn = body.labelEn.trim().slice(0, 50) || null;
  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (!isValidUrl(url)) return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
    data.url = url;
  }
  if (typeof body.icon === "string") data.icon = body.icon.trim().slice(0, 20) || null;
  if (typeof body.order === "number") data.order = body.order;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  const link = await prisma.popupLink.update({ where: { id }, data });
  return NextResponse.json(link);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { count } = await prisma.popupLink.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.code === "string") data.code = body.code.trim().toUpperCase().slice(0, 10);
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 50);
  if (typeof body.nameEn === "string") data.nameEn = body.nameEn.trim().slice(0, 50) || null;
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 500) || null;
  if (typeof body.order === "number") data.order = body.order;

  const building = await prisma.building.update({ where: { id }, data });
  return NextResponse.json(building);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await prisma.building.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

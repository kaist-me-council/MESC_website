import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ floorId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { floorId: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.level === "number") data.level = body.level;
  if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl.trim() || null;
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 500) || null;

  const floor = await prisma.buildingFloor.update({ where: { id }, data });
  return NextResponse.json(floor);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ floorId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { floorId: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await prisma.buildingFloor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

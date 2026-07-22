import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    wing?: number | null;
    name?: string | null;
    order?: number;
    posX?: number | null;
    posY?: number | null;
  };
  const data: Record<string, unknown> = {};
  if (typeof body.code === "string") data.code = body.code.trim().slice(0, 20);
  if ("wing" in body) data.wing = typeof body.wing === "number" ? body.wing : null;
  if ("name" in body) data.name = body.name ? body.name.trim().slice(0, 50) : null;
  if (typeof body.order === "number") data.order = body.order;
  for (const k of ["posX", "posY"] as const) {
    if (k in body) {
      if (body[k] === null) data[k] = null;
      else if (typeof body[k] === "number" && body[k]! >= 0 && body[k]! <= 1) data[k] = body[k];
      else return NextResponse.json({ error: `${k}는 0~1 범위여야 합니다.` }, { status: 400 });
    }
  }

  const room = await prisma.room.update({ where: { id }, data });
  return NextResponse.json(room);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { count } = await prisma.room.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

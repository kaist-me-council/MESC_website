import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isValidUrl, parseId } from "@/lib/validation";

function parseImages(v: unknown): string | null {
  let raw: unknown = v;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
  if (!Array.isArray(raw)) return null;
  const list = raw.filter((u): u is string => typeof u === "string" && isValidUrl(u) && u.length <= 500).slice(0, 8);
  return list.length ? JSON.stringify(list) : null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
  if (typeof body.nameEn === "string") data.nameEn = body.nameEn.trim().slice(0, 60) || null;
  if (typeof body.tagKo === "string") data.tagKo = body.tagKo.trim().slice(0, 60) || null;
  if (typeof body.tagEn === "string") data.tagEn = body.tagEn.trim().slice(0, 60) || null;
  if (typeof body.descKo === "string") data.descKo = body.descKo.trim().slice(0, 3000);
  if (typeof body.descEn === "string") data.descEn = body.descEn.trim().slice(0, 3000) || null;
  if (typeof body.imageUrl === "string") {
    const u = body.imageUrl.trim();
    if (u && !isValidUrl(u)) return NextResponse.json({ error: "올바른 이미지 URL 이 아닙니다." }, { status: 400 });
    data.imageUrl = u || null;
  }
  if (body.images !== undefined) data.images = parseImages(body.images);
  if (typeof body.order === "number") data.order = Math.max(0, Math.trunc(body.order));
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  if (typeof data.name === "string" && !data.name) return NextResponse.json({ error: "이름은 비울 수 없습니다." }, { status: 400 });
  if (typeof data.descKo === "string" && !data.descKo) return NextResponse.json({ error: "소개(한국어)는 비울 수 없습니다." }, { status: 400 });

  const mascot = await prisma.mascot.update({ where: { id }, data });
  revalidatePath("/members");
  return NextResponse.json(mascot);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const { count } = await prisma.mascot.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath("/members");
  return NextResponse.json({ ok: true });
}

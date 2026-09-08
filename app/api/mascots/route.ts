import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isValidUrl } from "@/lib/validation";

// 공개: enabled 마스코트 (정렬). 관리자는 비공개 항목도 함께 본다(작성 중 미리보기).
export async function GET() {
  const isAdmin = !!(await auth());
  const mascots = await prisma.mascot.findMany({
    where: isAdmin ? {} : { enabled: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(mascots, { headers: { "Cache-Control": "private, no-store" } });
}

function parseImages(v: unknown): string | null {
  let raw: unknown = v;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
  if (!Array.isArray(raw)) return null;
  const list = raw.filter((u): u is string => typeof u === "string" && isValidUrl(u) && u.length <= 500).slice(0, 8);
  return list.length ? JSON.stringify(list) : null;
}

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const descKo = typeof body.descKo === "string" ? body.descKo.trim().slice(0, 3000) : "";
  if (!name || !descKo) return NextResponse.json({ error: "이름과 소개(한국어)는 필수입니다." }, { status: 400 });

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (imageUrl && !isValidUrl(imageUrl)) return NextResponse.json({ error: "올바른 이미지 URL 이 아닙니다." }, { status: 400 });

  const mascot = await prisma.mascot.create({
    data: {
      name,
      nameEn: typeof body.nameEn === "string" ? body.nameEn.trim().slice(0, 60) || null : null,
      tagKo: typeof body.tagKo === "string" ? body.tagKo.trim().slice(0, 60) || null : null,
      tagEn: typeof body.tagEn === "string" ? body.tagEn.trim().slice(0, 60) || null : null,
      descKo,
      descEn: typeof body.descEn === "string" ? body.descEn.trim().slice(0, 3000) || null : null,
      imageUrl: imageUrl || null,
      images: parseImages(body.images),
      order: typeof body.order === "number" ? Math.max(0, Math.trunc(body.order)) : 0,
      enabled: body.enabled !== false,
    },
  });
  revalidatePath("/members"); // 학부 소개는 5분 ISR — 등록 즉시 보이도록 갱신
  return NextResponse.json(mascot, { status: 201 });
}

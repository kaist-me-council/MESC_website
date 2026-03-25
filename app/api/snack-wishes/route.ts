import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const rateMap = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) { rateMap.set(ip, { count: 1, reset: now + 10 * 60 * 1000 }); return true; }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function GET() {
  const wishes = await prisma.snackWish.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(wishes);
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip)) return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 100) return NextResponse.json({ error: "간식 이름을 입력해주세요. (최대 100자)" }, { status: 400 });

  const wish = await prisma.snackWish.create({ data: { content } });
  return NextResponse.json(wish, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await prisma.snackWish.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

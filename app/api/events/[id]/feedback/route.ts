import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/validation";

// IP 기반 rate limit (10분에 5회)
const rateMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const feedbacks = await prisma.eventFeedback.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(feedbacks);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip)) return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const rating = typeof body.rating === "number" ? Math.min(5, Math.max(1, Math.floor(body.rating))) : 3;

  if (!content || content.length > 500) return NextResponse.json({ error: "피드백 내용을 입력해주세요. (최대 500자)" }, { status: 400 });

  const feedback = await prisma.eventFeedback.create({
    data: { eventId: id, content, rating },
  });
  return NextResponse.json(feedback, { status: 201 });
}

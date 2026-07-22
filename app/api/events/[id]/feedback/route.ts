import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { checkContent } from "@/lib/content-filter";

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
  const raw = typeof body.content === "string" ? body.content.trim() : "";
  const content = raw.replace(/<[^>]*>/g, "").trim(); // HTML 태그 제거
  const rating = typeof body.rating === "number" ? Math.min(5, Math.max(1, Math.floor(body.rating))) : 3;

  if (!content || content.length > 500) return NextResponse.json({ error: "피드백 내용을 입력해주세요. (최대 500자)" }, { status: 400 });

  const block = checkContent(content);
  if (block.blocked) return NextResponse.json({ error: block.message }, { status: 400 });

  // 행사가 존재하는지 확인 (없는 eventId면 FK 위반 500 방지)
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "행사를 찾을 수 없습니다." }, { status: 404 });

  const feedback = await prisma.eventFeedback.create({
    data: { eventId: id, content, rating },
  });
  return NextResponse.json(feedback, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const eventId = parseId(idStr);
  if (!eventId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { feedbackId } = await req.json();
  if (!feedbackId) return NextResponse.json({ error: "feedbackId required" }, { status: 400 });

  const { count } = await prisma.eventFeedback.deleteMany({
    where: { id: Number(feedbackId), eventId },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

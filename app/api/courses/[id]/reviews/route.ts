import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId, isValidString } from "@/lib/validation";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { sanitize, checkContent } from "@/lib/content-filter";
import { hashPassword, ipHash } from "@/lib/anon";

// 공개: 특정 과목의 강의평 목록 + 평균/개수 (비밀번호 제외, 최신순)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const courseId = parseId(idStr);
  if (!courseId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [reviews, agg] = await Promise.all([
    prisma.courseReview.findMany({
      where: { courseId, hidden: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, rating: true, content: true, nickname: true, createdAt: true },
      take: 200,
    }),
    prisma.courseReview.aggregate({
      where: { courseId, hidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    reviews,
    average: agg._avg.rating ?? null,
    count: agg._count._all,
  });
}

// 강의평 작성 (닉네임 + 비밀번호)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const courseId = parseId(idStr);
  if (!courseId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const ip = getClientIp(req);
  // 1분에 5건
  const rl = enforce(ip, "course-reviews", 5, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `너무 자주 작성하셨습니다. ${Math.ceil(rl.retryAfter / 1000)}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    nickname?: string;
    password?: string;
    rating?: unknown;
    content?: string;
  };

  const nickname = sanitize(body.nickname ?? "");
  const content = sanitize(body.content ?? "");
  const password = typeof body.password === "string" ? body.password : "";
  const rating = Number(body.rating);

  if (!isValidString(nickname, 20) || nickname.length < 1) {
    return NextResponse.json({ error: "닉네임은 1~20자로 작성해주세요." }, { status: 400 });
  }
  if (password.length < 4 || password.length > 100) {
    return NextResponse.json({ error: "비밀번호는 4~100자로 입력해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "별점은 1~5 사이의 정수여야 합니다." }, { status: 400 });
  }
  if (!isValidString(content, 1000) || content.length < 5) {
    return NextResponse.json({ error: "내용은 5~1000자로 작성해주세요." }, { status: 400 });
  }

  const nBlock = checkContent(nickname);
  if (nBlock.blocked) return NextResponse.json({ error: `닉네임: ${nBlock.message}` }, { status: 400 });
  const cBlock = checkContent(content);
  if (cBlock.blocked) return NextResponse.json({ error: cBlock.message }, { status: 400 });

  // 과목이 존재하는지 확인
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "과목을 찾을 수 없습니다." }, { status: 404 });

  const review = await prisma.courseReview.create({
    data: {
      courseId,
      rating,
      content,
      nickname,
      passwordHash: hashPassword(password),
      ipHash: ipHash(ip),
    },
    select: { id: true, rating: true, content: true, nickname: true, createdAt: true },
  });

  return NextResponse.json(review, { status: 201 });
}

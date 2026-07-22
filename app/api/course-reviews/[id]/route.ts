import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId, isValidString } from "@/lib/validation";
import { sanitize, checkContent } from "@/lib/content-filter";
import { verifyPassword } from "@/lib/anon";

// 강의평 수정 (비밀번호 일치 시)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    password?: string;
    rating?: unknown;
    content?: string;
  };
  const password = typeof body.password === "string" ? body.password : "";

  const review = await prisma.courseReview.findUnique({
    where: { id },
    select: { id: true, passwordHash: true },
  });
  if (!review) return NextResponse.json({ error: "강의평을 찾을 수 없습니다." }, { status: 404 });

  if (!password || !verifyPassword(password, review.passwordHash)) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
  }

  const data: { rating?: number; content?: string } = {};

  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "별점은 1~5 사이의 정수여야 합니다." }, { status: 400 });
    }
    data.rating = rating;
  }

  if (body.content !== undefined) {
    const content = sanitize(body.content ?? "");
    if (!isValidString(content, 1000) || content.length < 5) {
      return NextResponse.json({ error: "내용은 5~1000자로 작성해주세요." }, { status: 400 });
    }
    const cBlock = checkContent(content);
    if (cBlock.blocked) return NextResponse.json({ error: cBlock.message }, { status: 400 });
    data.content = content;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const updated = await prisma.courseReview.update({
    where: { id },
    data,
    select: { id: true, rating: true, content: true, nickname: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(updated);
}

// 강의평 삭제 (비밀번호 일치 또는 관리자 세션)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const review = await prisma.courseReview.findUnique({
    where: { id },
    select: { id: true, passwordHash: true },
  });
  if (!review) return NextResponse.json({ error: "강의평을 찾을 수 없습니다." }, { status: 404 });

  // 관리자 세션이면 비밀번호 없이 삭제 허용
  const session = await auth();
  if (!session) {
    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || !verifyPassword(password, review.passwordHash)) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 403 });
    }
  }

  const { count } = await prisma.courseReview.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

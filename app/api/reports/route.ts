import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { ipHash } from "@/lib/anon";

const VALID_TARGETS = new Set(["post", "comment", "suggestion", "courseReview"]);
const AUTO_HIDE_THRESHOLD = 5;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // 신고 도배 방지 — 1분에 5건
  const rl = enforce(ip, "reports", 5, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `신고가 너무 잦습니다. ${Math.ceil(rl.retryAfter / 1000)}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    targetType?: string;
    targetId?: number;
    reason?: string;
  };

  if (!body.targetType || !VALID_TARGETS.has(body.targetType)) {
    return NextResponse.json({ error: "잘못된 신고 대상" }, { status: 400 });
  }
  if (typeof body.targetId !== "number" || body.targetId <= 0) {
    return NextResponse.json({ error: "잘못된 신고 ID" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) || null : null;

  const ipH = ipHash(ip);

  // 중복 신고 방지 — 같은 IP 가 같은 대상에 이미 신고했으면 skip
  const dup = await prisma.report.findFirst({
    where: { targetType: body.targetType, targetId: body.targetId, ipHash: ipH },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ ok: true, alreadyReported: true });
  }

  await prisma.report.create({
    data: { targetType: body.targetType, targetId: body.targetId, reason, ipHash: ipH },
  });

  // reportCount 증가 + 임계 초과 시 자동 hidden
  if (body.targetType === "post") {
    const updated = await prisma.post.update({
      where: { id: body.targetId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true, hidden: true },
    });
    if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
      await prisma.post.update({ where: { id: body.targetId }, data: { hidden: true } });
    }
  } else if (body.targetType === "comment") {
    const updated = await prisma.comment.update({
      where: { id: body.targetId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true, hidden: true },
    });
    if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
      await prisma.comment.update({ where: { id: body.targetId }, data: { hidden: true } });
    }
  } else if (body.targetType === "suggestion") {
    const updated = await prisma.suggestion.update({
      where: { id: body.targetId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true, hidden: true },
    });
    if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
      await prisma.suggestion.update({ where: { id: body.targetId }, data: { hidden: true } });
    }
  } else if (body.targetType === "courseReview") {
    const updated = await prisma.courseReview.update({
      where: { id: body.targetId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true, hidden: true },
    });
    if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
      await prisma.courseReview.update({ where: { id: body.targetId }, data: { hidden: true } });
    }
  }

  return NextResponse.json({ ok: true });
}

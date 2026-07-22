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

  const targetType = body.targetType;
  const targetId = body.targetId;
  const ipH = ipHash(ip);

  // 중복 신고 방지 — 같은 IP 가 같은 대상에 이미 신고했으면 skip
  const dup = await prisma.report.findFirst({
    where: { targetType, targetId, ipHash: ipH },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ ok: true, alreadyReported: true });
  }

  try {
    // create + reportCount 증가(+임계 초과 시 자동 hidden)를 원자적으로 처리.
    // 잘못된 targetId면 update 가 P2025 를 던지고 트랜잭션이 롤백돼 고아 Report 가 남지 않음.
    await prisma.$transaction(async (tx) => {
      await tx.report.create({
        data: { targetType, targetId, reason, ipHash: ipH },
      });

      if (targetType === "post") {
        const updated = await tx.post.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
          select: { reportCount: true, hidden: true },
        });
        if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
          await tx.post.update({ where: { id: targetId }, data: { hidden: true } });
        }
      } else if (targetType === "comment") {
        const updated = await tx.comment.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
          select: { reportCount: true, hidden: true },
        });
        if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
          await tx.comment.update({ where: { id: targetId }, data: { hidden: true } });
        }
      } else if (targetType === "suggestion") {
        const updated = await tx.suggestion.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
          select: { reportCount: true, hidden: true },
        });
        if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
          await tx.suggestion.update({ where: { id: targetId }, data: { hidden: true } });
        }
      } else if (targetType === "courseReview") {
        const updated = await tx.courseReview.update({
          where: { id: targetId },
          data: { reportCount: { increment: 1 } },
          select: { reportCount: true, hidden: true },
        });
        if (updated.reportCount >= AUTO_HIDE_THRESHOLD && !updated.hidden) {
          await tx.courseReview.update({ where: { id: targetId }, data: { hidden: true } });
        }
      }
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : null;
    if (code === "P2025") return NextResponse.json({ error: "신고 대상을 찾을 수 없습니다." }, { status: 404 });
    throw error;
  }

  return NextResponse.json({ ok: true });
}

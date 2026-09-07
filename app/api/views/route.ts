import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { attachVisitorCookie, getOrCreateVisitorToken, visitorHash } from "@/lib/visitor";

// 공개: 조회수 1 증가. 같은 방문자·같은 글은 24시간에 한 번만 센다.
// 실패해도 본문 열람을 막지 않도록 클라이언트는 결과를 무시한다(응답은 항상 같은 모양).

const KINDS = ["notice", "event", "post"] as const;
type Kind = (typeof KINDS)[number];
const DAY = 24 * 60 * 60 * 1000;
const BOT_RE = /bot|crawler|spider|slurp|bingpreview/i;
const noStore = { headers: { "Cache-Control": "private, no-store" } };

/** 존재·공개 여부 확인. 비공개·없는 글은 counted:false 로만 답해 존재 여부를 노출하지 않는다. */
async function isPublic(kind: Kind, id: number): Promise<boolean> {
  if (kind === "notice") return !!(await prisma.notice.findUnique({ where: { id }, select: { id: true } }));
  if (kind === "event") return !!(await prisma.event.findUnique({ where: { id }, select: { id: true } }));
  return !!(await prisma.post.findFirst({ where: { id, hidden: false }, select: { id: true } }));
}

function bump(tx: Prisma.TransactionClient, kind: Kind, id: number) {
  const data = { viewCount: { increment: 1 } };
  if (kind === "notice") return tx.notice.update({ where: { id }, data });
  if (kind === "event") return tx.event.update({ where: { id }, data });
  return tx.post.update({ where: { id }, data });
}

export async function POST(req: Request) {
  const notCounted = NextResponse.json({ counted: false }, noStore);
  if (!enforce(getClientIp(req), "views", 60, 60_000).ok) return notCounted;

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return notCounted; }
  const kind = KINDS.includes(b.kind as Kind) ? (b.kind as Kind) : null;
  const id = Number(b.id);
  if (!kind || !Number.isInteger(id) || id <= 0) return notCounted;

  // 관리자·봇은 세지 않는다
  if (BOT_RE.test(req.headers.get("user-agent") ?? "")) return notCounted;
  if (await auth()) return notCounted;

  const { token, isNew } = await getOrCreateVisitorToken();
  if (!(await isPublic(kind, id))) return attachVisitorCookie(notCounted, token, isNew);

  const viewerHash = visitorHash(token, "view");
  const cutoff = new Date(Date.now() - DAY);

  const counted = await prisma
    .$transaction(async (tx) => {
      const seen = await tx.contentView.findUnique({
        where: { kind_contentId_viewerHash: { kind, contentId: id, viewerHash } },
      });
      if (seen && seen.createdAt > cutoff) return false;
      if (seen) await tx.contentView.update({ where: { id: seen.id }, data: { createdAt: new Date() } });
      else await tx.contentView.create({ data: { kind, contentId: id, viewerHash } });
      await bump(tx, kind, id);
      return true;
    })
    // 동시 요청이 같은 방문자로 겹치면 유니크 위반 → 이미 센 것으로 처리
    .catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    });

  return attachVisitorCookie(NextResponse.json({ counted }, noStore), token, isNew);
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/validation";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { attachVisitorCookie, getOrCreateVisitorToken, visitorHash } from "@/lib/visitor";

// 공개: 좋아요 토글. 브라우저 토큰당 게시글 1개, 다시 누르면 취소.
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!enforce(getClientIp(req), "like", 30, 60_000).ok)
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429, ...noStore });

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400, ...noStore });

  // 숨김·삭제 게시글은 404
  const post = await prisma.post.findFirst({ where: { id, hidden: false }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404, ...noStore });

  const { token, isNew } = await getOrCreateVisitorToken();
  const voterHash = visitorHash(token, "like");

  const result = await prisma
    .$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({ where: { postId_voterHash: { postId: id, voterHash } } });
      if (existing) {
        await tx.postLike.delete({ where: { id: existing.id } });
        const p = await tx.post.update({ where: { id }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } });
        return { liked: false, likeCount: Math.max(0, p.likeCount) };
      }
      await tx.postLike.create({ data: { postId: id, voterHash } });
      const p = await tx.post.update({ where: { id }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } });
      return { liked: true, likeCount: p.likeCount };
    })
    // 같은 방문자의 동시 클릭 → 이미 눌린 상태로 수렴
    .catch(async (e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const p = await prisma.post.findUnique({ where: { id }, select: { likeCount: true } });
        return { liked: true, likeCount: p?.likeCount ?? 0 };
      }
      throw e;
    });

  return attachVisitorCookie(NextResponse.json(result, noStore), token, isNew);
}

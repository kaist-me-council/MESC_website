import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId, isValidString } from "@/lib/validation";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { sanitize, checkContent } from "@/lib/content-filter";
import { authorTag, ipHash } from "@/lib/anon";

// 익명 댓글 작성
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const postId = parseId(idStr);
  if (!postId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const ip = getClientIp(req);
  // 댓글은 관대 — 1분에 10건
  const rl = enforce(ip, "comments", 10, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `너무 자주 작성하셨습니다. ${Math.ceil(rl.retryAfter / 1000)}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = sanitize(body.content ?? "");
  if (!isValidString(content, 1000) || content.length < 1) {
    return NextResponse.json({ error: "댓글은 1~1000자로 작성해주세요." }, { status: 400 });
  }

  const block = checkContent(content);
  if (block.blocked) return NextResponse.json({ error: block.message }, { status: 400 });

  // 게시글이 존재하고 hidden 이 아닌지 확인
  const post = await prisma.post.findFirst({ where: { id: postId, hidden: false }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  // 댓글 생성 + 카운트 증가를 원자적으로 처리
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        postId,
        content,
        authorTag: authorTag(ip, postId),
        ipHash: ipHash(ip),
      },
    }),
    prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
  ]);

  return NextResponse.json(
    { id: comment.id, authorTag: comment.authorTag, content: comment.content, createdAt: comment.createdAt },
    { status: 201 },
  );
}

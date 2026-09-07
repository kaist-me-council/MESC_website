import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { readVisitorToken, visitorHash } from "@/lib/visitor";

// 공개: 게시글 1개 + 댓글
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const post = await prisma.post.findFirst({
    where: { id, hidden: false },
    select: {
      id: true,
      category: true,
      title: true,
      content: true,
      authorTag: true,
      commentCount: true,
      viewCount: true,
      likeCount: true,
      createdAt: true,
      comments: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, authorTag: true, createdAt: true },
      },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 현재 방문자가 좋아요를 눌렀는지 (쿠키가 없으면 false — 여기서 발급하지는 않는다)
  const token = await readVisitorToken();
  const liked = token
    ? !!(await prisma.postLike.findUnique({
        where: { postId_voterHash: { postId: id, voterHash: visitorHash(token, "like") } },
        select: { id: true },
      }))
    : false;
  return NextResponse.json({ ...post, liked });
}

// 관리자만: 강제 삭제 + hidden 토글
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { count } = await prisma.post.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { hidden?: boolean };
  if (typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "hidden 필드 필요" }, { status: 400 });
  }
  const post = await prisma.post.update({ where: { id }, data: { hidden: body.hidden } });
  return NextResponse.json(post);
}

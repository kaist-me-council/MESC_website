import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/validation";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { likeAction } from "@/lib/like-state";
import { readVisitorToken, visitorHash } from "@/lib/visitor";

// 공개: 좋아요. 브라우저 토큰당 게시글 1개.
//
// PUT { liked: true | false } 로 "목표 상태" 를 보낸다. 토글이 아니라서 같은 요청을
// 몇 번 재시도해도 결과가 같다 — 서버가 저장했는데 응답만 유실된 경우 재시도가
// 좋아요를 취소해 버리던 문제를 없앤다. 집계는 행이 실제로 바뀔 때만 증감한다.
//
// 방문자 토큰은 여기서 만들지 않는다. 쿠키가 없으면 409 로 알리고
// 클라이언트가 /api/visitor 로 확정한 뒤 다시 보낸다(V1).
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!enforce(getClientIp(req), "like", 30, 60_000).ok)
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429, ...noStore });

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400, ...noStore });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400, ...noStore }); }
  if (typeof body.liked !== "boolean")
    return NextResponse.json({ error: "liked 는 true 또는 false 여야 합니다." }, { status: 400, ...noStore });
  const target = body.liked;

  // 숨김·삭제 게시글은 404
  const post = await prisma.post.findFirst({ where: { id, hidden: false }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404, ...noStore });

  const token = await readVisitorToken();
  if (!token)
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요.", needsInit: true }, { status: 409, ...noStore });
  const voterHash = visitorHash(token, "like");

  const countOf = async () =>
    (await prisma.post.findUnique({ where: { id }, select: { likeCount: true } }))?.likeCount ?? 0;

  const result = await prisma
    .$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({ where: { postId_voterHash: { postId: id, voterHash } } });
      const action = likeAction(!!existing, target);

      if (action === "create") {
        await tx.postLike.create({ data: { postId: id, voterHash } });
        const p = await tx.post.update({ where: { id }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } });
        return { liked: true, likeCount: p.likeCount };
      }
      if (action === "delete") {
        await tx.postLike.delete({ where: { id: existing!.id } });
        const p = await tx.post.update({ where: { id }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } });
        return { liked: false, likeCount: Math.max(0, p.likeCount) };
      }
      // 이미 목표 상태 — 집계를 건드리지 않는다
      const p = await tx.post.findUnique({ where: { id }, select: { likeCount: true } });
      return { liked: target, likeCount: p?.likeCount ?? 0 };
    })
    // 같은 목표 상태의 동시 요청이 겹치면(생성 중복 P2002 / 삭제 경합 P2025) 목표 상태로 수렴한다
    .catch(async (e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2025"))
        return { liked: target, likeCount: await countOf() };
      throw e;
    });

  return NextResponse.json(result, noStore);
}

// 구 토글 POST 는 제거했다. 재시도가 좋아요를 취소해 버리는 경로라 남겨 둘 수 없다.
// 배포 직후 열려 있던 오래된 탭만 여기로 오므로 새로고침을 안내한다.
export async function POST() {
  return NextResponse.json(
    { error: "페이지를 새로고침한 뒤 다시 시도해주세요.", needsRefresh: true },
    { status: 409, ...noStore },
  );
}

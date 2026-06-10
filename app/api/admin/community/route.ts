import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 관리자 전용: 숨김 포함 + 신고순 정렬
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [suggestions, posts] = await Promise.all([
    prisma.suggestion.findMany({
      orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
      // ipHash 는 클라이언트로 보내지 않는다 (불필요한 식별자 노출 방지)
      select: {
        id: true,
        category: true,
        content: true,
        contactInfo: true,
        response: true,
        respondedAt: true,
        hidden: true,
        reportCount: true,
        createdAt: true,
      },
      take: 200,
    }),
    prisma.post.findMany({
      orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        authorTag: true,
        hidden: true,
        reportCount: true,
        commentCount: true,
        createdAt: true,
      },
      take: 200,
    }),
  ]);

  return NextResponse.json({ suggestions, posts });
}

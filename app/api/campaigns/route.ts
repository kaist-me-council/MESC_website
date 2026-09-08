import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/campaign";
import { auth } from "@/lib/auth";

// 공개: enabled 캠페인 목록 (최신순). 관리자 세션이면 비공개 캠페인도 미리보기용으로 포함한다.
export async function GET() {
  const isAdmin = !!(await auth());
  const rows = await prisma.campaign.findMany({
    where: isAdmin ? {} : { enabled: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { slug: true, title: true, titleEn: true, enabled: true, opensAt: true, closesAt: true },
  });
  return NextResponse.json(
    { campaigns: rows.map((c) => ({ slug: c.slug, title: c.title, titleEn: c.titleEn, open: isOpen(c), opensAt: c.opensAt, closesAt: c.closesAt, preview: !c.enabled })) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

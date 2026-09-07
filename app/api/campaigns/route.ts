import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/campaign";

// 공개: enabled 캠페인 목록 (최신순)
export async function GET() {
  const rows = await prisma.campaign.findMany({
    where: { enabled: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { slug: true, title: true, titleEn: true, enabled: true, opensAt: true, closesAt: true },
  });
  return NextResponse.json(
    { campaigns: rows.map((c) => ({ slug: c.slug, title: c.title, titleEn: c.titleEn, open: isOpen(c), opensAt: c.opensAt, closesAt: c.closesAt })) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

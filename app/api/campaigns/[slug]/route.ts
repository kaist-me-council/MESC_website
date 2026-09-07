import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { availability, publicCampaign } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };

// 공개: 캠페인 상세 + 옵션(남은 수량). enabled 아니면 404
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await prisma.campaign.findUnique({ where: { slug }, include: { options: true } });
  if (!c || !c.enabled) return NextResponse.json({ error: "Not found" }, { status: 404, ...noStore });
  return NextResponse.json({ campaign: publicCampaign(c, await availability(c.id)) }, noStore);
}

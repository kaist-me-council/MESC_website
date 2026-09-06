import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOpen, parseCampaignBody, PRESETS } from "@/lib/campaign";

// 관리자: 캠페인 목록·생성. body 파서는 lib/campaign.ts parseCampaignBody.

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  if (!(await auth())) return unauthorized();
  const rows = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { orders: { select: { status: true, confirmation: true } }, _count: { select: { options: true } } },
  });
  return NextResponse.json({
    campaigns: rows.map(({ orders, _count, ...c }) => ({
      ...c,
      open: isOpen(c),
      optionCount: _count.options,
      orderCount: orders.filter((o) => o.status !== "cancelled").length,
      paidCount: orders.filter((o) => o.status === "paid" || o.status === "delivered").length,
      confirmedCount: orders.filter((o) => o.confirmation).length,
    })),
  }, noStore);
}

export async function POST(req: Request) {
  if (!(await auth())) return unauthorized();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof b.preset === "string") {
    const preset = PRESETS[b.preset];
    if (!preset) return NextResponse.json({ error: "알 수 없는 프리셋입니다." }, { status: 400 });
    if (await prisma.campaign.findUnique({ where: { slug: preset.data.slug } })) return NextResponse.json({ error: "이미 만들어진 캠페인입니다." }, { status: 409 });
    const created = await prisma.campaign.create({ data: { ...preset.data, options: { create: preset.options } }, include: { options: true } });
    return NextResponse.json({ campaign: created }, { status: 201, ...noStore });
  }
  const parsed = parseCampaignBody(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (await prisma.campaign.findUnique({ where: { slug: parsed.data.slug } })) return NextResponse.json({ error: "이미 사용 중인 slug 입니다." }, { status: 409 });
  const created = await prisma.campaign.create({
    data: { ...parsed.data, options: parsed.options ? { create: parsed.options.map(({ id: _id, ...o }) => o) } : undefined },
    include: { options: true },
  });
  return NextResponse.json({ campaign: created }, { status: 201, ...noStore });
}

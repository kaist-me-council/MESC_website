import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { parseCampaignBody, type OrderItem } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return unauthorized();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const c = await prisma.campaign.findUnique({ where: { id }, include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign: c }, noStore);
}

/** 수정. options 가 오면 id 있는 건 update, 없는 건 create, 빠진 건 delete(주문에 쓰였으면 enabled=false). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return unauthorized();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = parseCampaignBody(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.campaign.findUnique({ where: { id }, include: { options: true, orders: { select: { items: true } } } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const dup = await prisma.campaign.findUnique({ where: { slug: parsed.data.slug } });
  if (dup && dup.id !== id) return NextResponse.json({ error: "이미 사용 중인 slug 입니다." }, { status: 409 });

  await prisma.campaign.update({ where: { id }, data: parsed.data });

  if (parsed.options) {
    const usedIds = new Set<number>();
    for (const o of existing.orders) for (const it of JSON.parse(o.items) as OrderItem[]) usedIds.add(it.optionId);
    const keep = new Set(parsed.options.map((o) => o.id).filter((x): x is number => !!x));
    const gone = existing.options.filter((o) => !keep.has(o.id));
    await prisma.$transaction([
      ...gone.map((o) =>
        usedIds.has(o.id)
          ? prisma.campaignOption.update({ where: { id: o.id }, data: { enabled: false } })
          : prisma.campaignOption.delete({ where: { id: o.id } }),
      ),
      ...parsed.options.map(({ id: oid, ...o }) =>
        oid && existing.options.some((e) => e.id === oid)
          ? prisma.campaignOption.update({ where: { id: oid }, data: o })
          : prisma.campaignOption.create({ data: { ...o, campaignId: id } }),
      ),
    ]);
  }

  const c = await prisma.campaign.findUnique({ where: { id }, include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } } });
  return NextResponse.json({ campaign: c }, noStore);
}

/** 주문 0건일 때만 삭제 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return unauthorized();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const orders = await prisma.campaignOrder.count({ where: { campaignId: id } });
  if (orders > 0) return NextResponse.json({ error: `신청 ${orders}건이 있어 삭제할 수 없습니다. 비공개로 전환하세요.` }, { status: 409 });
  const { count } = await prisma.campaign.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true }, noStore);
}

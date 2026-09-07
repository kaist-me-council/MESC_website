import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { ORDER_STATUSES, rebuildItems, type OrderItem, type Resolution } from "@/lib/campaign";

// 관리자: 신청 목록(JSON / CSV) · 상태·메모 변경. 학번 해시는 내보내지 않는다.

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const STATUS_KO: Record<string, string> = { pending: "대기", paid: "입금", delivered: "수령", cancelled: "취소" };
const itemStr = (items: OrderItem[]) => items.map((i) => `${i.group ? i.group + " " : ""}${i.name}×${i.qty}`).join(", ");
const CONFIRM_KO: Record<string, string> = { received: "받음", not_received: "못 받음" };
const CHOICE_KO: Record<string, string> = { pickup: "수령", refund: "환불", exchange: "교환" };
const adminRow = ({ studentIdHash, items, resolution, ...o }: Awaited<ReturnType<typeof prisma.campaignOrder.findMany>>[number]) => ({
  ...o,
  hasStudentId: !!studentIdHash,
  items: JSON.parse(items) as OrderItem[],
  resolution: resolution ? (JSON.parse(resolution) as Resolution[]) : null,
});
const resStr = (res: Resolution[] | null) =>
  res ? res.map((r) => `${r.group ? r.group + " " : ""}${r.name}×${r.qty}: ${CHOICE_KO[r.choice]}${r.choice === "exchange" && r.exchangeName ? "→" + r.exchangeName : ""}`).join(", ") : "";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return unauthorized();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const rows = await prisma.campaignOrder.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
  const orders = rows.map(adminRow);

  if (new URL(req.url).searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["주문번호", "상태", "구분", "이름", "입금자명", "이메일", "전화", "항목", "합계", "메모", "관리자메모", "신청시각", "출처", "수령확인", "처리선택", "확인메모", "확인시각", "처리완료", "배부자"];
    const lines = orders.map((o) =>
      [o.orderNo, STATUS_KO[o.status] ?? o.status, o.affiliation, o.name, o.depositorName, o.email, o.phone, itemStr(o.items), o.total, o.note, o.adminMemo, new Date(o.createdAt).toLocaleString("ko-KR"),
        o.source, o.confirmation ? CONFIRM_KO[o.confirmation] : "", resStr(o.resolution), o.confirmNote, o.confirmedAt ? new Date(o.confirmedAt).toLocaleString("ko-KR") : "", o.resolvedAt ? "O" : "", o.handedBy].map(esc).join(","),
    );
    return new NextResponse("﻿" + [head.map(esc).join(","), ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign-${id}-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return NextResponse.json({ orders }, noStore);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return unauthorized();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const validStatus = (v: unknown) => (ORDER_STATUSES as readonly string[]).includes(String(v));

  // 일괄: { orderIds, status } — 상태는 아무 값으로나 (입금 취소 = pending)
  if (Array.isArray(b.orderIds)) {
    const ids = (b.orderIds as unknown[]).map(Number).filter((n) => Number.isInteger(n));
    if (!ids.length || !validStatus(b.status)) return NextResponse.json({ error: "orderIds 와 status 가 필요합니다." }, { status: 400 });
    const bulkData: { status: string; handedBy?: string | null } = { status: String(b.status) };
    if (typeof b.handedBy === "string") bulkData.handedBy = b.handedBy.trim().slice(0, 50) || null; // 수령 일괄 처리 시 배부자
    const { count } = await prisma.campaignOrder.updateMany({ where: { id: { in: ids }, campaignId: id }, data: bulkData });
    return NextResponse.json({ updated: count }, noStore);
  }

  const orderId = Number(b.orderId);
  if (!Number.isInteger(orderId)) return NextResponse.json({ error: "orderId 필요" }, { status: 400 });
  const data: { status?: string; adminMemo?: string | null; depositorName?: string | null; items?: string; total?: number; confirmation?: string | null; confirmedAt?: Date | null; resolution?: null; resolvedAt?: Date | null; handedBy?: string | null } = {};
  if (b.status !== undefined) {
    if (!validStatus(b.status)) return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });
    data.status = String(b.status);
  }
  if (typeof b.adminMemo === "string") data.adminMemo = b.adminMemo.trim().slice(0, 500) || null;
  if (typeof b.depositorName === "string") data.depositorName = b.depositorName.trim().slice(0, 50) || null;
  if (typeof b.handedBy === "string") data.handedBy = b.handedBy.trim().slice(0, 50) || null;
  // 항목 수정(교환 처리용): 옵션·수량 검증 후 단가는 주문의 구분 기준으로 재계산. 재고는 검사하지 않음(관리자 판단)
  if (b.items !== undefined) {
    const [order, campaign] = await Promise.all([
      prisma.campaignOrder.findFirst({ where: { id: orderId, campaignId: id } }),
      prisma.campaign.findUnique({ where: { id }, include: { options: true } }),
    ]);
    if (!order || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rebuilt = rebuildItems(campaign.options, campaign, order.affiliation, b.items);
    if (typeof rebuilt === "string") return NextResponse.json({ error: rebuilt }, { status: 400 });
    data.items = JSON.stringify(rebuilt.items);
    data.total = rebuilt.total;
  }
  if (b.confirmation !== undefined) {
    if (b.confirmation !== null && b.confirmation !== "received" && b.confirmation !== "not_received") return NextResponse.json({ error: "confirmation 값이 올바르지 않습니다." }, { status: 400 });
    data.confirmation = b.confirmation as string | null;
    data.confirmedAt = b.confirmation ? new Date() : null;
    if (!b.confirmation) data.resolution = null;
  }
  if (typeof b.resolved === "boolean") data.resolvedAt = b.resolved ? new Date() : null; // 못 받음 건 처리 완료 표시
  const { count } = await prisma.campaignOrder.updateMany({ where: { id: orderId, campaignId: id }, data });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.campaignOrder.findUniqueOrThrow({ where: { id: orderId } });
  return NextResponse.json({ ok: true, order: adminRow(updated) }, noStore);
}

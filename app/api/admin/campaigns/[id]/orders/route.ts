import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { ORDER_STATUSES, type OrderItem } from "@/lib/campaign";

// 관리자: 신청 목록(JSON / CSV) · 상태·메모 변경. 학번 해시는 내보내지 않는다.

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const STATUS_KO: Record<string, string> = { pending: "대기", paid: "입금", delivered: "수령", cancelled: "취소" };
const itemStr = (items: OrderItem[]) => items.map((i) => `${i.group ? i.group + " " : ""}${i.name}×${i.qty}`).join(", ");

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return unauthorized();
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const rows = await prisma.campaignOrder.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
  const orders = rows.map(({ studentIdHash, items, ...o }) => ({ ...o, hasStudentId: !!studentIdHash, items: JSON.parse(items) as OrderItem[] }));

  if (new URL(req.url).searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["주문번호", "상태", "구분", "이름", "이메일", "전화", "항목", "합계", "메모", "관리자메모", "신청시각"];
    const lines = orders.map((o) =>
      [o.orderNo, STATUS_KO[o.status] ?? o.status, o.affiliation, o.name, o.email, o.phone, itemStr(o.items), o.total, o.note, o.adminMemo, new Date(o.createdAt).toLocaleString("ko-KR")].map(esc).join(","),
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
  const orderId = Number(b.orderId);
  if (!Number.isInteger(orderId)) return NextResponse.json({ error: "orderId 필요" }, { status: 400 });
  const data: { status?: string; adminMemo?: string | null } = {};
  if (b.status !== undefined) {
    if (!(ORDER_STATUSES as readonly string[]).includes(String(b.status))) return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });
    data.status = String(b.status);
  }
  if (typeof b.adminMemo === "string") data.adminMemo = b.adminMemo.trim().slice(0, 500) || null;
  const { count } = await prisma.campaignOrder.updateMany({ where: { id: orderId, campaignId: id }, data });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true }, noStore);
}

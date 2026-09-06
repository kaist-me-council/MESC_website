import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { studentIdHash } from "@/lib/tshirt";
import { findOwnOrders, parseOwnerCred, publicOrder } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, ...noStore });

// 공개: 본인 신청 취소 — 입금 확인 전(pending)만. 이후는 학생회 문의.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!enforce(getClientIp(req), "apply", 20, 60_000).ok) return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  const { slug } = await params;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Invalid JSON"); }
  const cred = parseOwnerCred(b, studentIdHash);
  const orderNo = typeof b.orderNo === "string" ? b.orderNo.trim().toUpperCase() : "";
  if (!cred || !orderNo) return bad("주문번호와 본인 확인 정보를 입력해주세요.");

  const c = await prisma.campaign.findUnique({ where: { slug } });
  if (!c) return bad("Not found", 404);
  const mine = await findOwnOrders(c.id, cred);
  const target = mine.find((o) => o.orderNo === orderNo);
  if (!target) return bad("일치하는 신청이 없습니다.", 404);
  if (target.status === "cancelled") return NextResponse.json({ order: publicOrder(target, c) }, noStore);
  if (target.status !== "pending") return bad("입금 확인 후에는 학생회에 문의해 취소해주세요.", 409);

  const updated = await prisma.campaignOrder.update({ where: { id: target.id }, data: { status: "cancelled" } });
  return NextResponse.json({ order: publicOrder(updated, c) }, noStore);
}

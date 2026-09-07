import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { hashEquals, manageCodeHash } from "@/lib/anon";
import { publicOrder } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, ...noStore });
const STATUS_KO: Record<string, string> = { pending: "입금 대기", paid: "입금 확인", delivered: "수령 완료", cancelled: "취소" };

/**
 * 공개: 본인 신청 취소 — 입금 확인 전(pending)만.
 * 이름·학번만으로는 취소할 수 없다. 신청 때 받은 주문번호 + 관리 코드가 필요하다.
 * 적재 주문(관리 코드 없음)은 취소 불가 — 학생회 문의로 안내한다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!enforce(getClientIp(req), "apply", 60, 60_000).ok) return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  const { slug } = await params;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Invalid JSON"); }
  const orderNo = typeof b.orderNo === "string" ? b.orderNo.trim().toUpperCase() : "";
  const manageCode = typeof b.manageCode === "string" ? b.manageCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{6}$/.test(orderNo) || !/^[A-Z0-9]{6,16}$/.test(manageCode)) {
    return bad("주문번호와 관리 코드를 입력해주세요.");
  }

  const c = await prisma.campaign.findUnique({ where: { slug } });
  if (!c) return bad("Not found", 404);
  const target = await prisma.campaignOrder.findUnique({ where: { orderNo } });
  // 존재 여부·코드 오류를 구분하지 않는다 (주문번호 열거 방지)
  if (!target || target.campaignId !== c.id || !target.manageCodeHash || !hashEquals(target.manageCodeHash, manageCodeHash(manageCode))) {
    return bad("주문번호 또는 관리 코드가 올바르지 않습니다.", 404);
  }
  if (target.status === "cancelled") return NextResponse.json({ order: publicOrder(target, c) }, noStore);
  if (target.status !== "pending") return bad("입금 확인 후에는 학생회에 문의해 취소해주세요.", 409);

  // 조회 시점 이후 관리자가 입금 확인했을 수 있다 → pending 인 동안에만 조건부로 바꾼다.
  const { count } = await prisma.campaignOrder.updateMany({
    where: { id: target.id, campaignId: c.id, status: "pending" },
    data: { status: "cancelled" },
  });
  if (count === 0) {
    const now = await prisma.campaignOrder.findUnique({ where: { id: target.id } });
    return bad(`이미 처리된 신청입니다. 현재 상태: ${STATUS_KO[now?.status ?? ""] ?? "확인 필요"}. 학생회에 문의해주세요.`, 409);
  }
  const updated = await prisma.campaignOrder.findUniqueOrThrow({ where: { id: target.id } });
  return NextResponse.json({ order: publicOrder(updated, c) }, noStore);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { studentIdHash } from "@/lib/tshirt";
import { CHOICES, findOwnOrders, isConfirmOpen, parseOwnerCred, publicOrder, type OrderItem, type Resolution } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, ...noStore });

// 공개: 수령 확인 응답 저장. 조회는 /lookup 을 쓴다.
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!enforce(getClientIp(req), "apply", 60, 60_000).ok) return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  const { slug } = await params;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Invalid JSON"); }
  // 상태 변경이므로 주문번호 단독은 받지 않는다 (이름 + 학번|이메일 필요).
  const cred = parseOwnerCred(b, studentIdHash, false);
  const orderNo = typeof b.orderNo === "string" ? b.orderNo.trim().toUpperCase() : "";
  if (!cred || !orderNo) return bad("주문번호와 이름·학번(또는 이메일)을 입력해주세요.");
  const confirmation = b.confirmation === "received" || b.confirmation === "not_received" ? b.confirmation : null;
  if (!confirmation) return bad("응답을 선택해주세요.");

  const c = await prisma.campaign.findUnique({ where: { slug }, include: { options: true } });
  if (!c || !c.enabled || !c.confirmEnabled) return bad("Not found", 404);
  if (!isConfirmOpen(c)) return bad("확인 기간이 종료되었습니다.", 403);

  const mine = await findOwnOrders(c.id, cred);
  const target = mine.find((o) => o.orderNo === orderNo);
  if (!target) return bad("일치하는 신청이 없습니다.", 404);

  // 못 받음: 주문 항목과 optionId 로 1:1 재구성. 교환 사이즈는 같은 그룹의 옵션 이름만 허용.
  let resolution: Resolution[] | null = null;
  if (confirmation === "not_received") {
    const items = JSON.parse(target.items) as OrderItem[];
    const raw = Array.isArray(b.resolution) ? (b.resolution as Partial<Resolution>[]) : [];
    resolution = items.map((it) => {
      const r = raw.find((x) => Number(x.optionId) === it.optionId) ?? {};
      const choice = (CHOICES as readonly string[]).includes(String(r.choice)) ? (r.choice as Resolution["choice"]) : "pickup";
      const exchangeName =
        choice === "exchange" && c.options.some((o) => (o.group ?? null) === it.group && o.name === String(r.exchangeName))
          ? String(r.exchangeName)
          : undefined;
      return { optionId: it.optionId, group: it.group, name: it.name, qty: it.qty, choice, exchangeName };
    });
  }
  const confirmNote = typeof b.note === "string" ? b.note.trim().slice(0, 500) || null : null;

  const updated = await prisma.campaignOrder.update({
    where: { id: target.id },
    data: { confirmation, resolution: resolution ? JSON.stringify(resolution) : null, confirmNote, confirmedAt: new Date() },
  });
  return NextResponse.json({ order: publicOrder(updated, c) }, noStore);
}

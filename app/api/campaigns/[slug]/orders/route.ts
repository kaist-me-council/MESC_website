import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { isValidString } from "@/lib/validation";
import { studentIdHash } from "@/lib/tshirt";
import { AFFILIATIONS, availability, isEmail, isOpen, makeOrderNo, publicOrder, unitPrice, type OrderItem } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, ...noStore });

// 공개: 신청 생성. 금액·재고는 서버가 계산/검증한다.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!enforce(getClientIp(req), "apply", 20, 60_000).ok) return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  const { slug } = await params;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Invalid JSON"); }

  const c = await prisma.campaign.findUnique({ where: { slug }, include: { options: true } });
  if (!c || !c.enabled) return bad("Not found", 404);
  if (!isOpen(c)) return bad("신청 기간이 아닙니다.", 403);

  const affiliation = typeof b.affiliation === "string" && (AFFILIATIONS as readonly string[]).includes(b.affiliation) ? b.affiliation : null;
  if (!affiliation) return bad("구분을 선택해주세요.");
  if (!isValidString(b.name, 50)) return bad("이름을 입력해주세요.");
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return bad("이메일 형식이 올바르지 않습니다.");
  const studentId = typeof b.studentId === "string" ? b.studentId.replace(/\D/g, "") : "";
  if (c.requireStudentId && (studentId.length < 5 || studentId.length > 10)) return bad("학번을 입력해주세요.");
  const phone = typeof b.phone === "string" ? b.phone.trim().slice(0, 30) || null : null;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) || null : null;

  // 항목 검증
  const raw = Array.isArray(b.items) ? (b.items as { optionId?: unknown; qty?: unknown }[]) : [];
  const byId = new Map(c.options.filter((o) => o.enabled).map((o) => [o.id, o]));
  const merged = new Map<number, number>();
  for (const it of raw) {
    const id = Number(it.optionId);
    const qty = c.allowQty ? Number(it.qty) : 1;
    if (!byId.has(id)) return bad("선택할 수 없는 옵션입니다.");
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return bad("수량이 올바르지 않습니다.");
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  if (!merged.size) return bad("옵션을 하나 이상 선택해주세요.");
  const totalQty = [...merged.values()].reduce((a, q) => a + q, 0);
  if (c.maxPerPerson && totalQty > c.maxPerPerson) return bad(`1인당 최대 ${c.maxPerPerson}개까지 신청할 수 있습니다.`);

  // ponytail: 재고는 읽고-검사-쓰기 (동시 신청 시 초과 가능). 초과가 실제로 나면 트랜잭션+재검사로 올릴 것
  const avail = await availability(c.id);
  const items: OrderItem[] = [];
  for (const [id, qty] of merged) {
    const o = byId.get(id)!;
    const rem = avail.get(id);
    if (rem !== null && rem !== undefined && rem < qty) return bad(`'${o.group ? o.group + " " : ""}${o.name}' 남은 수량이 부족합니다. (남음 ${Math.max(rem, 0)})`, 409, { optionId: id });
    items.push({ optionId: id, group: o.group, name: o.name, qty, unitPrice: unitPrice(o, c, affiliation) });
  }
  const total = items.reduce((a, it) => a + it.qty * it.unitPrice, 0);

  const order = await prisma.campaignOrder.create({
    data: {
      campaignId: c.id,
      orderNo: makeOrderNo(c.slug),
      affiliation,
      name: b.name.trim(),
      studentIdHash: studentId ? studentIdHash(studentId) : null,
      email,
      phone,
      items: JSON.stringify(items),
      total,
      note,
    },
  });
  return NextResponse.json({ order: publicOrder(order, c) }, { status: 201, ...noStore });
}

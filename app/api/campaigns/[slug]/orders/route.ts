import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { isValidString } from "@/lib/validation";
import { studentIdHash } from "@/lib/tshirt";
import { manageCodeHash } from "@/lib/anon";
import {
  AFFILIATIONS, availability, isEmail, isOpen, makeManageCode, makeOrderNo, personQtyUsed, publicOrder, unitPrice,
  type Db, type OrderItem,
} from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status, ...noStore });

/** 재고 부족·1인 한도 초과를 트랜잭션 안에서 던지기 위한 표식 */
class Rejected extends Error {
  constructor(readonly reason: string, readonly optionId?: number) { super(reason); }
}

// 공개: 신청 생성. 금액·재고·1인 한도는 서버가 계산/검증한다.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!enforce(getClientIp(req), "apply", 60, 60_000).ok) return bad("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
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
  const depositorName = typeof b.depositorName === "string" ? b.depositorName.trim().slice(0, 50) || null : null;
  const name = (b.name as string).trim();
  const sidHash = studentId ? studentIdHash(studentId) : null;

  // 재전송 방지 키 (클라이언트 생성). 형식만 검증하고 유일성은 DB 제약에 맡긴다.
  const idempotencyKey = typeof b.idempotencyKey === "string" && /^[A-Za-z0-9._~-]{8,64}$/.test(b.idempotencyKey.trim())
    ? b.idempotencyKey.trim()
    : null;
  if (idempotencyKey) {
    const dup = await prisma.campaignOrder.findFirst({ where: { campaignId: c.id, idempotencyKey } });
    if (dup) return NextResponse.json({ order: publicOrder(dup, c), replayed: true }, noStore);
  }

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

  const items: OrderItem[] = [...merged].map(([id, qty]) => {
    const o = byId.get(id)!;
    return { optionId: id, group: o.group, name: o.name, qty, unitPrice: unitPrice(o, c, affiliation) };
  });
  const total = items.reduce((a, it) => a + it.qty * it.unitPrice, 0);
  const manageCode = makeManageCode();

  // 재고 재검사 + 1인 누적 한도 + 생성. 검사와 쓰기 사이가 갈라지면 초과 판매가 나므로 한 트랜잭션에서 한다.
  const create = async (db: Db) => {
    const hasStock = [...merged.keys()].some((id) => byId.get(id)!.stock !== null);
    if (hasStock) {
      const avail = await availability(c.id, db);
      for (const [id, qty] of merged) {
        const rem = avail.get(id);
        if (rem !== null && rem !== undefined && rem < qty) {
          const o = byId.get(id)!;
          throw new Rejected(`'${o.group ? o.group + " " : ""}${o.name}' 남은 수량이 부족합니다. (남음 ${Math.max(rem, 0)})`, id);
        }
      }
    }
    if (c.maxPerPerson) {
      const used = await personQtyUsed(db, c.id, { studentIdHash: sidHash, email, name });
      if (used + totalQty > c.maxPerPerson) {
        throw new Rejected(`1인당 최대 ${c.maxPerPerson}개까지 신청할 수 있습니다. (이미 ${used}개 신청)`);
      }
    }
    return db.campaignOrder.create({
      data: {
        campaignId: c.id,
        orderNo: makeOrderNo(c.slug),
        affiliation,
        name,
        studentIdHash: sidHash,
        email,
        phone,
        items: JSON.stringify(items),
        total,
        note,
        depositorName,
        manageCodeHash: manageCodeHash(manageCode),
        idempotencyKey,
      },
    });
  };

  const needsTx = [...merged.keys()].some((id) => byId.get(id)!.stock !== null) || !!c.maxPerPerson;
  try {
    const order = needsTx ? await prisma.$transaction(create) : await create(prisma);
    return NextResponse.json({ order: publicOrder(order, c, manageCode) }, { status: 201, ...noStore });
  } catch (e) {
    if (e instanceof Rejected) return bad(e.reason, 409, e.optionId ? { optionId: e.optionId } : {});
    // 재전송이 동시에 들어와 unique 제약에 걸린 경우 기존 주문을 돌려준다.
    if (idempotencyKey) {
      const dup = await prisma.campaignOrder.findFirst({ where: { campaignId: c.id, idempotencyKey } });
      if (dup) return NextResponse.json({ order: publicOrder(dup, c), replayed: true }, noStore);
    }
    // SQLite 쓰기 경합(SQLITE_BUSY) 등 — 재고 경쟁에서 진 쪽. 다시 시도하면 정확한 사유를 받는다.
    console.error("[campaign order] create failed", e);
    return bad("동시에 신청이 몰렸습니다. 잠시 후 다시 시도해주세요.", 409);
  }
}

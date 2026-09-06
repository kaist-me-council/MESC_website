import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { isValidString } from "@/lib/validation";
import { SIZES, studentIdHash, publicRecord, isDeadlinePassed, type Resolution } from "@/lib/tshirt";

// 반팔티 1차 구매 확인 — 비회원. 학번(해시)+이름 또는 이메일+이름 둘 다 맞아야 응답.
// 존재 여부 열거 방지: 실패는 전부 { found: false }, IP 당 분당 10회(조회+응답 공용).

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const normName = (s: string) => s.replace(/\s+/g, "").toLowerCase();

interface Cred { name: string; studentId?: string; email?: string }

function parseCred(b: Record<string, unknown>): Cred | null {
  if (!isValidString(b.name, 50)) return null;
  const studentId = typeof b.studentId === "string" ? b.studentId.replace(/\D/g, "") : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!studentId && !email) return null;
  if (studentId && (studentId.length < 5 || studentId.length > 10)) return null;
  if (email && email.length > 100) return null;
  return { name: b.name.trim(), studentId: studentId || undefined, email: email || undefined };
}

async function findMatches(c: Cred) {
  const or = [];
  if (c.studentId) or.push({ studentIdHash: studentIdHash(c.studentId) });
  if (c.email) or.push({ email: c.email });
  const rows = await prisma.priorPurchase.findMany({ where: { OR: or }, orderBy: { id: "asc" } });
  return rows.filter((r) => normName(r.name) === normName(c.name));
}

function limited(req: Request) {
  const r = enforce(getClientIp(req), "shop-check", 10, 60_000);
  return r.ok ? null : NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429, ...noStore });
}

export async function POST(req: Request) {
  const block = limited(req);
  if (block) return block;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const cred = parseCred(body);
  if (!cred) return NextResponse.json({ error: "이름과 학번(또는 이메일)을 입력해주세요." }, { status: 400, ...noStore });

  const rows = await findMatches(cred);
  if (!rows.length) return NextResponse.json({ found: false }, noStore);
  return NextResponse.json({ found: true, records: rows.map(publicRecord) }, noStore);
}

export async function PUT(req: Request) {
  const block = limited(req);
  if (block) return block;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const cred = parseCred(body);
  const id = Number(body.id);
  if (!cred || !Number.isInteger(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400, ...noStore });
  if (isDeadlinePassed()) return NextResponse.json({ error: "회신 기간이 종료되었습니다." }, { status: 403, ...noStore });

  const response = body.response === "received" || body.response === "not_received" ? body.response : null;
  if (!response) return NextResponse.json({ error: "응답을 선택해주세요." }, { status: 400, ...noStore });

  const rows = await findMatches(cred);
  const target = rows.find((r) => r.id === id);
  if (!target) return NextResponse.json({ found: false }, noStore);

  // 못 받음: 항목별 선택 검증 (구매 항목과 1:1)
  let resolution: Resolution[] | null = null;
  if (response === "not_received") {
    const items = JSON.parse(target.items) as Resolution[];
    const raw = Array.isArray(body.resolution) ? (body.resolution as Partial<Resolution>[]) : [];
    resolution = items.map((it, i) => {
      const r = raw[i] ?? {};
      const choice = r.choice === "pickup" || r.choice === "refund" || r.choice === "exchange" ? r.choice : "pickup";
      const exchangeSize = choice === "exchange" && (SIZES as readonly string[]).includes(String(r.exchangeSize)) ? (r.exchangeSize as Resolution["exchangeSize"]) : undefined;
      return { color: it.color, size: it.size, qty: it.qty, choice, exchangeSize };
    });
  }
  const responseNote = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const updated = await prisma.priorPurchase.update({
    where: { id },
    data: { response, resolution: resolution ? JSON.stringify(resolution) : null, responseNote, respondedAt: new Date() },
  });
  return NextResponse.json({ found: true, record: publicRecord(updated) }, noStore);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { isValidString } from "@/lib/validation";
import { studentIdHash } from "@/lib/tshirt";
import { findOwnOrders, isEmail, publicOrder } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };

// 공개: 내 신청 조회 — 이름 + (학번 | 이메일). 없으면 빈 배열 (존재 여부 비노출)
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!enforce(getClientIp(req), "apply", 20, 60_000).ok) return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429, ...noStore });
  const { slug } = await params;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const studentId = typeof b.studentId === "string" ? b.studentId.replace(/\D/g, "") : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!isValidString(b.name, 50) || (!studentId && !isEmail(email))) {
    return NextResponse.json({ error: "이름과 학번(또는 이메일)을 입력해주세요." }, { status: 400, ...noStore });
  }
  const c = await prisma.campaign.findUnique({ where: { slug } });
  if (!c) return NextResponse.json({ orders: [] }, noStore);

  const mine = await findOwnOrders(c.id, b.name as string, studentId ? studentIdHash(studentId) : null, email || null);
  return NextResponse.json({ orders: mine.map((o) => publicOrder(o, c)) }, noStore);
}

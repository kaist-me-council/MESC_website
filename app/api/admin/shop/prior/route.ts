import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseDistributionCsv } from "@/lib/tshirt-parse";
import { studentIdHash, type Item, type Resolution } from "@/lib/tshirt";

// 관리자: 반팔티 1차 구매 명단 import / 목록 / CSV / 응답 대리 입력. 학번 해시는 어떤 응답에도 내보내지 않는다.

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const itemStr = (items: Item[]) =>
  items.map((i) => `${i.color === "white" ? "흰" : "검"} ${i.size}×${i.qty}`).join(", ");
const resStr = (res: Resolution[] | null) =>
  res
    ? res
        .map((r) => `${r.color === "white" ? "흰" : "검"} ${r.size}×${r.qty}: ${r.choice === "pickup" ? "수령" : r.choice === "refund" ? "환불" : `교환→${r.exchangeSize}`}`)
        .join(", ")
    : "";

export async function GET(req: Request) {
  if (!(await auth())) return unauthorized();
  const rows = await prisma.priorPurchase.findMany({ orderBy: [{ affiliation: "asc" }, { name: "asc" }] });
  const list = rows.map((r) => ({
    id: r.id,
    affiliation: r.affiliation,
    name: r.name,
    email: r.email,
    phone: r.phone,
    hasStudentId: !!r.studentIdHash,
    items: JSON.parse(r.items) as Item[],
    pickedUp: r.pickedUp,
    memo: r.memo,
    response: r.response,
    resolution: r.resolution ? (JSON.parse(r.resolution) as Resolution[]) : null,
    responseNote: r.responseNote,
    respondedAt: r.respondedAt,
  }));

  if (new URL(req.url).searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["구분", "이름", "이메일", "전화", "구매 항목", "배부 기록 픽업", "응답", "처리 선택", "메모", "비고(import)", "응답 시각"];
    const lines = list.map((r) =>
      [r.affiliation, r.name, r.email, r.phone, itemStr(r.items), r.pickedUp ? "O" : "", r.response === "received" ? "받음" : r.response === "not_received" ? "못 받음" : "", resStr(r.resolution), r.responseNote, r.memo, r.respondedAt ? new Date(r.respondedAt).toLocaleString("ko-KR") : ""].map(esc).join(","),
    );
    return new NextResponse("﻿" + [head.map(esc).join(","), ...lines].join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tshirt-prior-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" },
    });
  }
  return NextResponse.json({ rows: list }, noStore);
}

/** CSV import. replace=true 면 기존 명단을 지우고 다시 넣는다(응답도 초기화되므로 메일 발송 전에만 사용). */
export async function POST(req: Request) {
  if (!(await auth())) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.csv !== "string" || body.csv.length > 2_000_000) return NextResponse.json({ error: "csv 문자열이 필요합니다." }, { status: 400 });

  const { rows, problems } = parseDistributionCsv(body.csv, studentIdHash);
  if (body.dryRun) return NextResponse.json({ count: rows.length, problems, preview: rows.slice(0, 5).map((r) => ({ ...r, studentIdHash: undefined })) }, noStore);

  if (body.replace) await prisma.priorPurchase.deleteMany({});
  await prisma.priorPurchase.createMany({
    data: rows.map((r) => ({ ...r, items: JSON.stringify(r.items) })),
  });
  return NextResponse.json({ imported: rows.length, problems }, noStore);
}

/** 관리자 대리 응답/메모 (전화·카톡으로 받은 회신 기록) */
export async function PUT(req: Request) {
  if (!(await auth())) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (body.response === "received" || body.response === "not_received" || body.response === null) {
    data.response = body.response;
    data.respondedAt = body.response ? new Date() : null;
    if (!body.response) data.resolution = null;
  }
  if (typeof body.responseNote === "string") data.responseNote = body.responseNote.trim().slice(0, 500) || null;
  if (typeof body.memo === "string") data.memo = body.memo.trim().slice(0, 300) || null;
  const updated = await prisma.priorPurchase.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: updated.id }, noStore);
}

export async function DELETE() {
  if (!(await auth())) return unauthorized();
  const { count } = await prisma.priorPurchase.deleteMany({});
  return NextResponse.json({ deleted: count }, noStore);
}

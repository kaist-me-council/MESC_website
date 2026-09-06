import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId } from "@/lib/validation";
import { studentIdHash } from "@/lib/tshirt";
import { ensureOptions, importOrders, parseImportCsv } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };

/**
 * 관리자: CSV → 주문 적재 (source import). mode "tshirt"(배부 시트) | "generic".
 * dryRun: 해석 결과·문제 행·새로 생길 옵션만 반환. replace: import 주문만 지우고 다시 넣음(웹 주문 보존).
 * 학번은 파서에서 즉시 해시, 원문은 응답에 없다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof b.csv !== "string" || b.csv.length > 2_000_000) return NextResponse.json({ error: "csv 문자열이 필요합니다." }, { status: 400 });
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { rows, problems } = parseImportCsv(b.mode === "tshirt" ? "tshirt" : "generic", b.csv, studentIdHash);
  const { created } = await ensureOptions(id, rows.flatMap((r) => r.items), true);
  if (b.dryRun) {
    return NextResponse.json(
      { count: rows.length, problems, newOptions: created, preview: rows.slice(0, 5).map(({ studentIdHash: h, ...r }) => ({ ...r, hasStudentId: !!h })) },
      noStore,
    );
  }
  if (b.replace) await prisma.campaignOrder.deleteMany({ where: { campaignId: id, source: "import" } });
  const result = await importOrders(campaign, rows);
  return NextResponse.json({ ...result, problems }, noStore);
}

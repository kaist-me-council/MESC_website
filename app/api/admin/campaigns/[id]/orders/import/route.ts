import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { studentIdHash } from "@/lib/tshirt";
import { ensureOptions, importOrders, parseImportCsv } from "@/lib/campaign";

const noStore = { headers: { "Cache-Control": "private, no-store" } };

/**
 * 관리자: CSV → 주문 적재 (source import). mode "tshirt"(배부 시트) | "generic".
 * dryRun: 해석 결과·문제 행·새로 생길 옵션만 반환 (옵션을 만들지 않는다).
 * replace: 기존 import 주문을 지우고 다시 넣음(웹 주문 보존).
 *
 * 데이터 보호: 파싱·검증을 모두 통과한 뒤에만 삭제한다. 문제 행이 하나라도 있거나 0건이면
 * 400 으로 거부하고 기존 주문·수령 확인 응답·메모는 그대로 남는다. 삭제와 생성은 한 트랜잭션.
 * 학번은 파서에서 즉시 해시, 원문은 응답에 없다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof b.csv !== "string" || b.csv.length > 2_000_000) return NextResponse.json({ error: "csv 문자열이 필요합니다." }, { status: 400 });
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { rows, problems } = parseImportCsv(b.mode === "tshirt" ? "tshirt" : "generic", b.csv, studentIdHash);

  if (b.dryRun) {
    const [{ created }, orders, confirmed] = await Promise.all([
      ensureOptions(id, rows.flatMap((r) => r.items), true), // 미리보기 — 옵션을 만들지 않는다
      prisma.campaignOrder.count({ where: { campaignId: id, source: "import" } }),
      prisma.campaignOrder.count({ where: { campaignId: id, source: "import", confirmation: { not: null } } }),
    ]);
    return NextResponse.json(
      { count: rows.length, problems, newOptions: created, willDelete: { orders, confirmed }, preview: rows.slice(0, 5).map(({ studentIdHash: h, ...r }) => ({ ...r, hasStudentId: !!h })) },
      noStore,
    );
  }

  // 실행 전 게이트 — 여기서 막히면 기존 데이터는 손대지 않는다.
  if (problems.length) return NextResponse.json({ error: `해석하지 못한 행이 ${problems.length}건 있어 적재하지 않았습니다. CSV 를 고친 뒤 다시 시도해주세요.`, problems }, { status: 400, ...noStore });
  if (!rows.length) return NextResponse.json({ error: "적재할 행이 없습니다.", problems }, { status: 400, ...noStore });

  const result = await prisma.$transaction(async (tx) => {
    if (b.replace) await tx.campaignOrder.deleteMany({ where: { campaignId: id, source: "import" } });
    return importOrders(campaign, rows, tx);
  });
  await audit(session.user?.name ?? "unknown", "order.import", `campaign:${id}`, `${rows.length}건 적재${b.replace ? " (기존 적재분 교체)" : ""}`);
  return NextResponse.json({ ...result, problems }, noStore);
}

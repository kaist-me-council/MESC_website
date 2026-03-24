import { NextResponse } from "next/server";

const BUDGET_CSV_URL = process.env.GOOGLE_BUDGET_CSV_URL ?? "";

let cachedSummary: BudgetSummary | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

interface BudgetSummary {
  income: number;
  expense: number;
  balance: number;
  monthlyData: MonthlyData[];
}

/** RFC 4180 호환 CSV 파서 — 따옴표 안의 쉼표/줄바꿈 처리 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

/** ₩ 기호, 쉼표 제거 후 숫자 파싱 */
function parseAmount(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[₩,\s]/g, "").replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

async function fetchBudgetSummary(): Promise<BudgetSummary> {
  const now = Date.now();
  if (cachedSummary && now - cacheTime < CACHE_DURATION) {
    return cachedSummary;
  }

  if (!BUDGET_CSV_URL) {
    return { income: 0, expense: 0, balance: 0, monthlyData: [] };
  }

  const res = await fetch(BUDGET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("예산 시트를 불러올 수 없습니다.");

  const text = await res.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return { income: 0, expense: 0, balance: 0, monthlyData: [] };
  }

  // 헤더 행 자동 탐색: "수입" 또는 "지출" 컬럼이 있는 첫 번째 행
  let headerRowIdx = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const normalized = rows[i].map((h) => h.toLowerCase().replace(/\s/g, ""));
    const hasIncome = normalized.some((h) => h.includes("수입") || h.includes("income") || h.includes("입금"));
    const hasExpense = normalized.some((h) => h.includes("지출") || h.includes("expense") || h.includes("출금"));
    if (hasIncome || hasExpense) {
      headerRowIdx = i;
      header = normalized;
      break;
    }
  }

  if (headerRowIdx < 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[budget-summary] 헤더 행을 찾을 수 없습니다. 전체 헤더:", rows.slice(0, 5).map(r => r.join("|")));
    }
    return { income: 0, expense: 0, balance: 0, monthlyData: [] };
  }

  const dataRows = rows.slice(headerRowIdx + 1);

  // 컬럼 인덱스 감지
  const dateIdx = header.findIndex((h) => h.includes("날짜") || h.includes("일자") || h.includes("사업일") || h.includes("date"));
  const incomeIdx = header.findIndex((h) => h.includes("수입") || h.includes("income") || h.includes("입금"));
  const expenseIdx = header.findIndex((h) => h.includes("지출") || h.includes("expense") || h.includes("출금"));

  if (process.env.NODE_ENV === "development") {
    console.log(`[budget-summary] 헤더(${headerRowIdx}행): ${header.join(", ")}`);
    console.log(`[budget-summary] 날짜:${dateIdx}, 수입:${incomeIdx}, 지출:${expenseIdx}`);
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const monthlyMap: Record<string, MonthlyData> = {};

  for (const row of dataRows) {
    // 빈 행, 합계 행 스킵 (모든 셀이 비었거나 "합계"/"계" 포함)
    if (row.every((c) => !c)) continue;
    const rowText = row.join("");
    if (rowText.includes("합계") || rowText.includes("소계") || rowText.includes("계")) continue;

    const incomeVal = incomeIdx >= 0 ? parseAmount(row[incomeIdx] ?? "") : 0;
    const expenseVal = expenseIdx >= 0 ? parseAmount(row[expenseIdx] ?? "") : 0;

    totalIncome += incomeVal;
    totalExpense += expenseVal;

    // 월별 집계
    if (dateIdx >= 0 && row[dateIdx]) {
      const dateStr = row[dateIdx].replace(/\s/g, "");
      // YYYYMMDD or YYYY/MM/DD or YYYY-MM-DD
      const match = dateStr.match(/(\d{4})[./\-]?(\d{2})/);
      if (match) {
        const key = `${match[1]}-${match[2]}`;
        if (!monthlyMap[key]) {
          monthlyMap[key] = { month: key, income: 0, expense: 0 };
        }
        monthlyMap[key].income += incomeVal;
        monthlyMap[key].expense += expenseVal;
      }
    }
  }

  const monthlyData = Object.values(monthlyMap).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const summary: BudgetSummary = {
    income: totalIncome,
    expense: totalExpense,
    balance: totalIncome - totalExpense,
    monthlyData,
  };

  cachedSummary = summary;
  cacheTime = now;
  return summary;
}

export async function GET() {
  try {
    const summary = await fetchBudgetSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[budget-summary]", error);
    return NextResponse.json(
      { error: "예산 데이터를 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

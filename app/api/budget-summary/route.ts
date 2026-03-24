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

function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
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
  const rows = text
    .split("\n")
    .filter((row) => row.trim().length > 0)
    .map((row) =>
      row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").trim())
    );

  if (rows.length < 2) {
    return { income: 0, expense: 0, balance: 0, monthlyData: [] };
  }

  const header = rows[0].map((h) => h.toLowerCase());
  const dataRows = rows.slice(1);

  // 컬럼 인덱스 자동 감지
  const dateIdx = header.findIndex((h) => h.includes("날짜") || h.includes("일자") || h.includes("date"));
  const incomeIdx = header.findIndex((h) => h.includes("수입") || h.includes("income") || h.includes("입금"));
  const expenseIdx = header.findIndex((h) => h.includes("지출") || h.includes("expense") || h.includes("출금"));

  if (process.env.NODE_ENV === "development") {
    console.log(`[budget-summary] 헤더: ${header.join(", ")}`);
    console.log(`[budget-summary] 날짜:${dateIdx}, 수입:${incomeIdx}, 지출:${expenseIdx}`);
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const monthlyMap: Record<string, MonthlyData> = {};

  for (const row of dataRows) {
    const incomeVal = incomeIdx >= 0 ? parseAmount(row[incomeIdx] ?? "") : 0;
    const expenseVal = expenseIdx >= 0 ? parseAmount(row[expenseIdx] ?? "") : 0;

    totalIncome += incomeVal;
    totalExpense += expenseVal;

    // 월별 집계
    if (dateIdx >= 0 && row[dateIdx]) {
      const dateStr = row[dateIdx];
      const match = dateStr.match(/(\d{4})[./\-]?(\d{1,2})/);
      if (match) {
        const key = `${match[1]}-${match[2].padStart(2, "0")}`;
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

import { NextRequest, NextResponse } from "next/server";

// CSV URL은 서버에서만 참조 (클라이언트에 절대 노출 금지)
const FEE_CSV_URL = process.env.GOOGLE_FEE_CSV_URL ?? "";

// 5분 캐시
let cachedData: string[][] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

// Simple in-memory rate limiter (IP당 분당 10회)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function fetchSheetData(): Promise<string[][]> {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_DURATION) {
    return cachedData;
  }

  if (!FEE_CSV_URL) throw new Error("CSV URL이 설정되지 않았습니다.");

  const res = await fetch(FEE_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Google Sheets 데이터를 불러올 수 없습니다.");

  const text = await res.text();
  // CSV 파싱: 쉼표 분리, 따옴표 제거
  const rows = text
    .split("\n")
    .filter((row) => row.trim().length > 0)
    .map((row) =>
      row
        .split(",")
        .map((cell) => cell.trim().replace(/^"|"$/g, "").trim())
    );

  cachedData = rows;
  cacheTime = now;
  return rows;
}

export async function GET(req: NextRequest) {
  // Rate limit 체크
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("id")?.trim();

  if (!studentId) {
    return NextResponse.json({ error: "학번을 입력해주세요." }, { status: 400 });
  }

  // 학번 형식 기본 검증 (숫자만, 6~12자리)
  if (!/^\d{6,12}$/.test(studentId)) {
    return NextResponse.json(
      { error: "올바른 학번 형식이 아닙니다." },
      { status: 400 }
    );
  }

  try {
    const rows = await fetchSheetData();

    if (rows.length === 0) {
      return NextResponse.json({ count: 0, found: false });
    }

    const headerRow = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ""));
    const dataRows = rows.slice(1);

    // 학번 컬럼 인덱스: 환경변수로 설정 가능, 없으면 헤더에서 자동 감지
    const colEnv = process.env.FEE_STUDENT_ID_COLUMN;
    let idColumnIndex = colEnv !== undefined && colEnv !== "" ? parseInt(colEnv, 10) : -1;

    if (idColumnIndex < 0) {
      for (let i = 0; i < headerRow.length; i++) {
        const h = headerRow[i];
        if (h.includes("학번") || h === "id" || h.includes("번호")) {
          idColumnIndex = i;
          break;
        }
      }
      if (idColumnIndex < 0) idColumnIndex = 0;
    }

    // 납부 횟수 컬럼 인덱스: "납부" 또는 "횟수" 포함 컬럼 자동 감지
    let paymentColumnIndex = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (h.includes("납부") || h.includes("횟수") || h.includes("payment")) {
        paymentColumnIndex = i;
        break;
      }
    }

    // 개발 환경 디버깅 로그
    if (process.env.NODE_ENV === "development") {
      console.log(`[check-fee] 총 ${dataRows.length}행, 학번 컬럼: ${idColumnIndex}, 납부횟수 컬럼: ${paymentColumnIndex}`);
    }

    // 해당 학번의 행을 찾아 납부 횟수 컬럼 값을 반환
    const matchedRow = dataRows.find((row) => {
      const cellValue = row[idColumnIndex]?.replace(/\s/g, "");
      return cellValue === studentId;
    });

    if (!matchedRow) {
      return NextResponse.json({ found: false, count: 0 });
    }

    // 납부 횟수 컬럼 값 파싱 (없으면 0)
    const rawCount = paymentColumnIndex >= 0 ? matchedRow[paymentColumnIndex] ?? "0" : "0";
    const paymentCount = parseInt(rawCount.replace(/\s/g, ""), 10);
    const count = isNaN(paymentCount) ? 0 : paymentCount;

    // 개인정보 전혀 미포함 — count만 반환
    return NextResponse.json({ found: true, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[check-fee]", message);
    return NextResponse.json(
      { error: `데이터를 불러오는 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}

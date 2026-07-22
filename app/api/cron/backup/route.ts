import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

// Vercel Cron (vercel.json) 이 주 1회 호출. 전 테이블을 JSON으로 덤프해 Blob에 저장.
// ponytail: sqlite_master 동적 열거 — 모델 하드코딩 대비 스키마 변경 시 누락 위험 없음.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' AND name NOT LIKE '_libsql%'`
    );

    const dump: Record<string, unknown[]> = {};
    for (const { name } of tables) {
      dump[name] = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}"`);
    }

    const json = JSON.stringify(dump);
    const date = new Date().toISOString().slice(0, 10);
    // 이 Blob 스토어는 public(행사 사진용). addRandomSuffix로 추측 불가능한 URL 생성 —
    // 파일명만으로는 접근 불가, 복원 시 list({ prefix: "backups/" })로 조회. (private 스토어 불필요)
    const blob = await put(`backups/backup-${date}.json`, json, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/json",
    });

    return NextResponse.json({ ok: true, tables: tables.length, bytes: json.length, url: blob.url });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

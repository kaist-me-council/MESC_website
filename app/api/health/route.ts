import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 배포 검증용 헬스체크.
 *
 * 왜 있는가: 2026-09-08~09 사이 vercel.json 의 ignoreCommand 가 프로덕션 빌드까지
 * 스킵해 11시간 동안 어떤 병합도 라이브에 반영되지 않았는데 아무도 몰랐다.
 * 병합한 커밋이 실제로 서빙 중인지 확인할 방법이 없었던 것이 원인이다.
 * commit 값을 로컬 HEAD 와 비교하면 그 사고를 즉시 잡을 수 있다.
 *
 *   curl -s https://<도메인>/api/health
 *   npm run verify:deploy        # HEAD 와 자동 비교
 */
export async function GET() {
  let db: "ok" | "fail" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "fail";
  }

  return NextResponse.json(
    {
      ok: db === "ok",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      env: process.env.VERCEL_ENV ?? "local",
      db,
      time: new Date().toISOString(),
    },
    {
      status: db === "ok" ? 200 : 503,
      // 캐시되면 옛 배포의 커밋이 보여 검증이 무의미해진다.
      headers: { "Cache-Control": "no-store" },
    }
  );
}

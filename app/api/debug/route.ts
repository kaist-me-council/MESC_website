import { NextResponse } from "next/server";

export async function GET() {
  const errors: string[] = [];
  
  // Prisma 연결 테스트
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.member.count();
    return NextResponse.json({ ok: true, memberCount: count });
  } catch (e: unknown) {
    errors.push(String(e));
    return NextResponse.json({ ok: false, error: String(e), env: {
      DATABASE_URL: process.env.DATABASE_URL ? process.env.DATABASE_URL.slice(0, 30) + "..." : "NOT SET",
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "SET" : "NOT SET",
    }}, { status: 500 });
  }
}

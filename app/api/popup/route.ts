import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 공개: 활성 팝업 + 활성 링크 반환
export async function GET() {
  const settings = await prisma.popupSettings.findUnique({ where: { id: 1 } });
  const links = await prisma.popupLink.findMany({
    where: { enabled: true },
    orderBy: { order: "asc" },
  });

  if (!settings) {
    return NextResponse.json({
      enabled: false,
      title: "기계공학과 학생회",
      message: null,
      links: [],
    });
  }

  return NextResponse.json({
    enabled: settings.enabled,
    title: settings.title,
    message: settings.message,
    links,
  });
}

// 인증: 팝업 설정 업데이트 (단일 행 upsert)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const enabled = Boolean(body.enabled);
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 100) : "기계공학과 학생회";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) || null : null;

  const settings = await prisma.popupSettings.upsert({
    where: { id: 1 },
    update: { enabled, title, message },
    create: { id: 1, enabled, title, message },
  });

  return NextResponse.json(settings);
}

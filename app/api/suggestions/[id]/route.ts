import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseId, isValidString } from "@/lib/validation";

// 관리자: 답변 작성/수정 + 숨김 토글
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    response?: string | null;
    hidden?: boolean;
  };

  const data: Record<string, unknown> = {};
  if ("response" in body) {
    if (body.response === null || body.response === "") {
      data.response = null;
      data.respondedAt = null;
    } else if (typeof body.response === "string" && isValidString(body.response, 2000)) {
      data.response = body.response.trim();
      data.respondedAt = new Date();
    } else {
      return NextResponse.json({ error: "답변은 1~2000자여야 합니다." }, { status: 400 });
    }
  }
  if (typeof body.hidden === "boolean") data.hidden = body.hidden;

  const updated = await prisma.suggestion.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { count } = await prisma.suggestion.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

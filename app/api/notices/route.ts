import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isValidString, isAllowedCategory } from "@/lib/validation";

const ALLOWED_CATEGORIES = ["공지", "행사", "학사"];

export async function GET() {
  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(notices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (!isValidString(b.title, 200)) {
    return NextResponse.json({ error: "제목은 1~200자 이내여야 합니다." }, { status: 400 });
  }
  if (!isValidString(b.content, 10000)) {
    return NextResponse.json({ error: "내용은 1~10000자 이내여야 합니다." }, { status: 400 });
  }

  const category = isAllowedCategory(b.category, ALLOWED_CATEGORIES) ? b.category : "공지";

  const notice = await prisma.notice.create({
    data: {
      title: b.title.trim(),
      titleEn: typeof b.titleEn === "string" ? b.titleEn.trim().slice(0, 200) || null : null,
      content: b.content.trim(),
      contentEn: typeof b.contentEn === "string" ? b.contentEn.trim().slice(0, 10000) || null : null,
      category,
      pinned: Boolean(b.pinned),
    },
  });
  revalidatePath("/");
  return NextResponse.json(notice);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl, isAllowedCategory } from "@/lib/validation";

const ALLOWED_CATEGORIES = ["200", "300", "400", "기타"];

export async function GET() {
  const resources = await prisma.resource.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(resources);
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
  if (typeof b.fileUrl !== "string" || !isValidUrl(b.fileUrl)) {
    return NextResponse.json({ error: "올바른 URL을 입력해주세요. (http/https만 허용)" }, { status: 400 });
  }
  if (b.description !== undefined && b.description !== null) {
    if (!isValidString(b.description, 500) && b.description !== "") {
      return NextResponse.json({ error: "설명은 500자 이내여야 합니다." }, { status: 400 });
    }
  }

  const category = isAllowedCategory(b.category, ALLOWED_CATEGORIES) ? b.category : "기타";
  const courseCode = typeof b.courseCode === "string" && b.courseCode.trim() ? b.courseCode.trim() : null;

  const resource = await prisma.resource.create({
    data: {
      title: (b.title as string).trim(),
      description: b.description ? String(b.description).trim() : null,
      fileUrl: b.fileUrl as string,
      category,
      courseCode,
    },
  });
  return NextResponse.json(resource);
}

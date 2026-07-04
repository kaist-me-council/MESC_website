import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl, isAllowedCategory } from "@/lib/validation";

const ALLOWED_LEVELS = ["200", "300", "400", "기타"];

export async function GET() {
  const [courses, ratings] = await Promise.all([
    prisma.course.findMany({ orderBy: [{ level: "asc" }, { order: "asc" }] }),
    prisma.courseReview.groupBy({
      by: ["courseId"],
      where: { hidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const byCourse = new Map(ratings.map((r) => [r.courseId, r]));
  const withRatings = courses.map((course) => {
    const r = byCourse.get(course.id);
    return {
      ...course,
      averageRating: r?._avg.rating ?? null,
      reviewCount: r?._count._all ?? 0,
    };
  });

  return NextResponse.json(withRatings);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "기타";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const descriptionEn = typeof body.descriptionEn === "string" ? body.descriptionEn.trim() : "";
  const textbook = typeof body.textbook === "string" ? body.textbook.trim() : "";
  const textbookAvailable = body.textbookAvailable === true;
  const youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : "";
  const order = typeof body.order === "number" ? Math.floor(body.order) : 0;

  if (!isValidString(code, 20)) return NextResponse.json({ error: "과목코드를 입력해주세요. (최대 20자)" }, { status: 400 });
  if (!isValidString(name, 100)) return NextResponse.json({ error: "과목명을 입력해주세요. (최대 100자)" }, { status: 400 });
  if (nameEn && nameEn.length > 150) return NextResponse.json({ error: "영문 과목명은 최대 150자까지 입력할 수 있습니다." }, { status: 400 });
  if (!isAllowedCategory(level, ALLOWED_LEVELS)) return NextResponse.json({ error: "올바른 레벨을 선택해주세요." }, { status: 400 });
  if (youtubeUrl && !isValidUrl(youtubeUrl)) return NextResponse.json({ error: "올바른 유튜브 URL을 입력해주세요." }, { status: 400 });

  try {
    const course = await prisma.course.create({
      data: {
        code,
        name,
        nameEn: nameEn || null,
        level,
        description: description || null,
        descriptionEn: descriptionEn || null,
        textbook: textbook || null,
        textbookAvailable,
        youtubeUrl: youtubeUrl || null,
        order,
      },
    });
    return NextResponse.json(course, { status: 201 });
  } catch {
    return NextResponse.json({ error: "이미 존재하는 과목코드입니다." }, { status: 409 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString, isValidUrl } from "@/lib/validation";

const MAX_QUANTITY = 999;
const MAX_ORDER = 1_000_000;

function getPrismaCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

function normalizeBookPayload(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const titleEn = typeof body.titleEn === "string" ? body.titleEn.trim() : "";
  const author = typeof body.author === "string" ? body.author.trim() : "";
  const publisher = typeof body.publisher === "string" ? body.publisher.trim() : "";
  const coverImage = typeof body.coverImage === "string" ? body.coverImage.trim() : "";
  const isbn = typeof body.isbn === "string" ? body.isbn.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const quantity = Number.isFinite(Number(body.quantity)) ? Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(body.quantity)))) : 1;
  const available = body.available !== false;
  const order = Number.isFinite(Number(body.order))
    ? Math.max(-MAX_ORDER, Math.min(MAX_ORDER, Math.floor(Number(body.order))))
    : 0;
  const courseIdRaw = body.courseId === "" || body.courseId === null ? null : Number(body.courseId);
  const courseId = Number.isInteger(courseIdRaw) && Number(courseIdRaw) > 0 ? Number(courseIdRaw) : null;

  return {
    title,
    titleEn,
    author,
    publisher,
    coverImage,
    isbn,
    quantity,
    available,
    category,
    courseId,
    order,
  };
}

export async function GET() {
  try {
    const books = await prisma.book.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
          },
        },
      },
    });
    return NextResponse.json(books);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = normalizeBookPayload(body);

  if (!isValidString(data.title, 150)) return NextResponse.json({ error: "책 제목을 입력해주세요. (최대 150자)" }, { status: 400 });
  if (data.titleEn && data.titleEn.length > 200) return NextResponse.json({ error: "영문 제목은 최대 200자까지 입력할 수 있습니다." }, { status: 400 });
  if (data.author && data.author.length > 150) return NextResponse.json({ error: "저자는 최대 150자까지 입력할 수 있습니다." }, { status: 400 });
  if (data.publisher && data.publisher.length > 100) return NextResponse.json({ error: "출판사는 최대 100자까지 입력할 수 있습니다." }, { status: 400 });
  if (data.isbn && data.isbn.length > 30) return NextResponse.json({ error: "ISBN은 최대 30자까지 입력할 수 있습니다." }, { status: 400 });
  if (data.category && data.category.length > 40) return NextResponse.json({ error: "분류는 최대 40자까지 입력할 수 있습니다." }, { status: 400 });
  if (data.coverImage && !isValidUrl(data.coverImage)) return NextResponse.json({ error: "올바른 표지 이미지 URL을 입력해주세요." }, { status: 400 });
  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "연결할 과목을 찾을 수 없습니다." }, { status: 400 });
  }

  try {
    const book = await prisma.book.create({
      data: {
        title: data.title,
        titleEn: data.titleEn || null,
        author: data.author || null,
        publisher: data.publisher || null,
        coverImage: data.coverImage || null,
        isbn: data.isbn || null,
        quantity: data.quantity,
        available: data.available,
        category: data.category || null,
        courseId: data.courseId,
        order: data.order,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
          },
        },
      },
    });

    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    const code = getPrismaCode(error);
    if (code === "P2003") return NextResponse.json({ error: "연결할 과목을 찾을 수 없습니다." }, { status: 400 });
    return NextResponse.json({ error: "전공서 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

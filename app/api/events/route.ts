import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidString } from "@/lib/validation";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: { photos: { orderBy: { order: "asc" } }, _count: { select: { feedbacks: true } } },
  });
  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const coverImage = typeof body.coverImage === "string" ? body.coverImage.trim() : "";

  if (!isValidString(title, 100)) return NextResponse.json({ error: "행사명을 입력해주세요." }, { status: 400 });
  if (!date) return NextResponse.json({ error: "날짜를 입력해주세요." }, { status: 400 });

  const event = await prisma.event.create({
    data: { title, date: new Date(date), description: description || null, coverImage: coverImage || null },
  });
  return NextResponse.json(event, { status: 201 });
}

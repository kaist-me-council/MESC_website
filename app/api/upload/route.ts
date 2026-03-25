import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: "JPG, PNG, WebP, GIF 이미지만 업로드 가능합니다." }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`uploads/${Date.now()}-${safeName}`, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json({ error: "업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}

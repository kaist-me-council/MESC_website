import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sharp from "sharp";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// Vercel 서버리스 본문 한도(4.5MB) 안쪽. 이 경로는 sharp 로 재인코딩해 EXIF 를 지우므로
// 반드시 서버를 거쳐야 한다. 더 큰 파일이 필요하면 첨부파일처럼 직접 업로드로 바꿔야 한다.
const MAX_SIZE = 4 * 1024 * 1024; // 4MB

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
      return NextResponse.json({ error: "파일 크기는 4MB 이하여야 합니다." }, { status: 400 });

    // sharp 로 재인코딩: 실제 이미지인지 검증 + EXIF(GPS·기기정보) 제거. rotate()는 EXIF 방향을 먼저 적용.
    let buffer: Buffer;
    let width: number | null = null;
    let height: number | null = null;
    try {
      const img = sharp(Buffer.from(await file.arrayBuffer()), { animated: file.type === "image/gif" }).rotate();
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      buffer = await img.toBuffer();
    } catch {
      return NextResponse.json({ error: "손상됐거나 지원하지 않는 이미지입니다." }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`uploads/${Date.now()}-${safeName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url, width, height });
  } catch {
    return NextResponse.json({ error: "업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/validation";
import { enforce, getClientIp } from "@/lib/rate-limit";
import { fetchFileContent, getAccessTokenOrNull } from "@/lib/drive-oauth";

// 공지 첨부 다운로드. 드라이브 파일은 우리가 중계해서 내려 준다.
// 덕분에 파일을 공개로 바꿀 필요가 없고, 학생은 드라이브 화면을 보지 않는다.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!enforce(getClientIp(req), "attach", 30, 60_000).ok)
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const a = await prisma.noticeAttachment.findUnique({ where: { id } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Blob 에 있는 기존 첨부는 그대로 그 URL 로 보낸다.
  if (!a.driveFileId) {
    if (!a.url) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.redirect(a.url);
  }

  const tok = await getAccessTokenOrNull().catch(() => null);
  if (!tok) return NextResponse.json({ error: "파일 저장소에 연결하지 못했습니다." }, { status: 503 });

  const res = await fetchFileContent(tok.accessToken, a.driveFileId);
  if (!res.ok || !res.body) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // filename* 은 RFC 5987 — 한글 파일명이 깨지지 않는다.
  const encoded = encodeURIComponent(a.name);
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": a.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "Content-Length": String(a.size),
      "Cache-Control": "private, max-age=300",
    },
  });
}

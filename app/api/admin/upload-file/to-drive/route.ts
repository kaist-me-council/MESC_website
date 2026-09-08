import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ATTACHMENT_MAX_SIZE, EXT_RULES } from "@/lib/upload-rules";
import { ensurePrivateSubfolder, getAccessTokenOrNull, uploadFile } from "@/lib/drive-oauth";

// 이미 Blob 에 올라간 첨부를 학생회 구글 드라이브로 옮긴다.
//
// 왜 이렇게 하나: 브라우저에서 구글로 직접 PUT 하는 방식은 사전 요청(preflight)이 브라우저에서
// 통과하지 못했다(curl 로 같은 요청을 보내면 허용 헤더가 정상으로 돌아온다). 반면 서버에서
// 구글로 올리는 것은 CORS 와 무관하고, 서버는 파일을 "요청 본문으로 받는" 게 아니라
// Blob URL 에서 "받아오는" 것이라 4.5MB 본문 한도에도 걸리지 않는다.
//
// 실패해도 Blob 첨부가 그대로 남으므로 사용자 입장에서는 파일을 잃지 않는다.
export const maxDuration = 60;

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const url = typeof b.url === "string" ? b.url : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 255) : "";
  const size = Number(b.size);
  if (!BLOB_HOST.test(url) || !name) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400, ...noStore });
  if (!Number.isFinite(size) || size <= 0 || size > ATTACHMENT_MAX_SIZE)
    return NextResponse.json({ error: "크기가 올바르지 않습니다." }, { status: 400, ...noStore });

  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const rule = EXT_RULES[ext];
  if (!rule) return NextResponse.json({ error: "허용되지 않는 형식입니다." }, { status: 400, ...noStore });

  const tok = await getAccessTokenOrNull();
  if (!tok?.auth.parentFolderId)
    return NextResponse.json({ moved: false, reason: "drive_not_connected" }, noStore);

  try {
    const folderId = await ensurePrivateSubfolder({
      accessToken: tok.accessToken,
      parentId: tok.auth.parentFolderId,
      name: "공지 첨부",
    });
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`blob fetch ${res.status}`);
    const buf = await res.arrayBuffer();
    const uploaded = await uploadFile(
      tok.accessToken,
      { name, type: rule.mime, arrayBuffer: async () => buf },
      folderId,
    );
    // 드라이브로 옮겼으니 Blob 사본은 정리 (실패해도 무해)
    await del(url).catch(() => {});
    await audit(session.user?.name ?? "unknown", "attachment.toDrive", `drive:${uploaded.id}`, `${name} (${size}B)`);
    return NextResponse.json({ moved: true, driveFileId: uploaded.id, name, size, mime: rule.mime }, noStore);
  } catch (e) {
    // 옮기기에 실패하면 Blob 첨부를 그대로 쓴다 — 파일을 잃지 않는 것이 우선
    console.error("[to-drive]", e);
    return NextResponse.json({ moved: false, reason: "copy_failed" }, noStore);
  }
}

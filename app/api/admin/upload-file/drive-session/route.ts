import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_MAX_MB, EXT_RULES } from "@/lib/upload-rules";
import { createResumableSession, ensurePrivateSubfolder, getAccessTokenOrNull, DriveOAuthError } from "@/lib/drive-oauth";

// 브라우저가 구글 드라이브로 직접 올릴 재개 가능 업로드 세션을 만든다.
// 파일이 우리 서버를 통과하지 않으므로 Vercel 의 4.5MB 본문 한도에 걸리지 않는다.
const ATTACH_FOLDER = "공지 첨부";
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 255) : "";
  const size = Number(b.size);
  if (!name) return NextResponse.json({ error: "파일 이름이 필요합니다." }, { status: 400, ...noStore });
  if (!Number.isFinite(size) || size <= 0)
    return NextResponse.json({ error: "빈 파일은 첨부할 수 없습니다." }, { status: 400, ...noStore });
  if (size > ATTACHMENT_MAX_SIZE)
    return NextResponse.json({ error: `파일 크기는 ${ATTACHMENT_MAX_MB}MB 이하여야 합니다.` }, { status: 400, ...noStore });

  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const rule = EXT_RULES[ext];
  if (!rule)
    return NextResponse.json(
      { error: `허용되지 않는 형식입니다. (가능: ${Object.keys(EXT_RULES).join(", ")})` },
      { status: 400, ...noStore },
    );

  let tok;
  try {
    tok = await getAccessTokenOrNull();
  } catch (e) {
    // refresh token 만료 등 — 연결을 다시 해야 한다. 클라이언트는 Blob 으로 넘어간다.
    return NextResponse.json(
      { error: e instanceof DriveOAuthError ? e.message : "Drive 인증에 실패했습니다.", code: "drive_not_connected" },
      { status: 409, ...noStore },
    );
  }
  if (!tok)
    return NextResponse.json(
      { error: "구글 드라이브가 연결되어 있지 않습니다.", code: "drive_not_connected" },
      { status: 409, ...noStore },
    );
  if (!tok.auth.parentFolderId)
    return NextResponse.json(
      { error: "Drive 기본 폴더가 설정되어 있지 않습니다.", code: "drive_not_connected" },
      { status: 409, ...noStore },
    );

  try {
    const folderId = await ensurePrivateSubfolder(tok.accessToken, tok.auth.parentFolderId, ATTACH_FOLDER);
    const sessionUri = await createResumableSession(
      tok.accessToken,
      { name, mimeType: rule.mime, size },
      folderId,
    );
    return NextResponse.json({ sessionUri, mime: rule.mime }, noStore);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof DriveOAuthError ? e.message : "업로드 세션 생성에 실패했습니다.", code: "drive_error" },
      { status: 502, ...noStore },
    );
  }
}

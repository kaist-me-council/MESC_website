import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAnonSalt } from "@/lib/anon";
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_MAX_MB, EXT_RULES } from "@/lib/upload-rules";
import { createResumableSession, ensurePrivateSubfolder, getAccessTokenOrNull } from "@/lib/drive-oauth";
import { signUploadId } from "@/lib/upload-id";

// 첨부 업로드 1단계: 구글 드라이브 재개 가능 세션을 열고, 그 정보를 서명해 uploadId 로 돌려준다.
// 실제 바이트는 drive-chunk 가 3MB 씩 중계한다 (Vercel 함수 본문 4.5MB 한도 회피).

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const TICKET_TTL = 2 * 60 * 60 * 1000; // 2시간

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 255) : "";
  const size = Number(b.size);
  if (!name) return NextResponse.json({ error: "파일 이름이 필요합니다." }, { status: 400, ...noStore });
  if (!Number.isInteger(size) || size <= 0)
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

  const tok = await getAccessTokenOrNull();
  if (!tok?.auth.parentFolderId)
    return NextResponse.json(
      { error: "구글 드라이브가 연결되어 있지 않습니다. 사이트 설정에서 연결해주세요.", code: "drive_not_connected" },
      { status: 409, ...noStore },
    );

  try {
    const parentId = await ensurePrivateSubfolder({
      accessToken: tok.accessToken,
      parentId: tok.auth.parentFolderId,
      name: "공지 첨부",
    });
    const sessionUri = await createResumableSession({
      accessToken: tok.accessToken,
      name,
      mimeType: rule.mime,
      parentId,
      size,
    });
    const uploadId = signUploadId(
      { u: sessionUri, n: name, s: size, m: rule.mime, e: Date.now() + TICKET_TTL },
      getAnonSalt(),
    );
    return NextResponse.json({ uploadId }, noStore);
  } catch (e) {
    console.error("[drive-begin]", e);
    return NextResponse.json({ error: "업로드를 시작하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 502, ...noStore });
  }
}

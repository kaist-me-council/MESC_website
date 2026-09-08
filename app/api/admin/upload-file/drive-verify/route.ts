import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_MAX_MB, EXT_RULES, signatureOk } from "@/lib/upload-rules";
import { deleteFile, fetchFileContent, getAccessTokenOrNull, getFileSize } from "@/lib/drive-oauth";

// 드라이브에 올라간 파일이 실제로 존재하고, 확장자와 내용이 맞는지 확인한다.
// Blob 쪽 /verify 와 같은 규칙. 불일치면 드라이브 파일을 지우고 거부한다.
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const fileId = typeof b.driveFileId === "string" ? b.driveFileId.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 255) : "";
  const size = Number(b.size);
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId))
    return NextResponse.json({ error: "올바른 파일 ID 가 아닙니다." }, { status: 400, ...noStore });
  if (!name) return NextResponse.json({ error: "파일 이름이 필요합니다." }, { status: 400, ...noStore });

  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const rule = EXT_RULES[ext];

  const tok = await getAccessTokenOrNull().catch(() => null);
  if (!tok)
    return NextResponse.json({ error: "구글 드라이브가 연결되어 있지 않습니다.", code: "drive_not_connected" }, { status: 409, ...noStore });

  const drop = async () => { await deleteFile(tok.accessToken, fileId); };

  if (!rule) {
    await drop();
    return NextResponse.json(
      { error: `허용되지 않는 형식입니다. (가능: ${Object.keys(EXT_RULES).join(", ")})` },
      { status: 400, ...noStore },
    );
  }

  try {
    const meta = await getFileSize(tok.accessToken, fileId);
    if (meta.size > ATTACHMENT_MAX_SIZE) {
      await drop();
      return NextResponse.json({ error: `파일 크기는 ${ATTACHMENT_MAX_MB}MB 이하여야 합니다.` }, { status: 400, ...noStore });
    }
    if (meta.size <= 0) {
      await drop();
      return NextResponse.json({ error: "빈 파일은 첨부할 수 없습니다." }, { status: 400, ...noStore });
    }
    // 브라우저가 보고한 크기와 실제가 다르면 업로드가 중간에 끊긴 것.
    if (Number.isFinite(size) && size > 0 && meta.size !== size) {
      await drop();
      return NextResponse.json({ error: "업로드가 완전히 끝나지 않았습니다. 다시 시도해주세요." }, { status: 400, ...noStore });
    }

    const head = await fetchFileContent(tok.accessToken, fileId, "bytes=0-511");
    if (!head.ok && head.status !== 206) throw new Error("range fetch failed");
    const buf = Buffer.from(await head.arrayBuffer());
    if (!signatureOk(rule.group, buf)) {
      await drop();
      return NextResponse.json({ error: "파일 내용이 확장자와 일치하지 않습니다." }, { status: 400, ...noStore });
    }
    return NextResponse.json(
      { url: "", driveFileId: fileId, name, size: meta.size, mime: rule.mime },
      noStore,
    );
  } catch {
    await drop();
    return NextResponse.json({ error: "업로드한 파일을 확인하지 못했습니다. 다시 시도해주세요." }, { status: 400, ...noStore });
  }
}

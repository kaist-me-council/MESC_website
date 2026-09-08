import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { EXT_RULES, signatureOk } from "@/lib/upload-rules";

// 드라이브가 연결돼 있지 않을 때만 쓰는 대비책. 파일이 서버 함수를 통과하므로
// Vercel 본문 한도(4.5MB) 안쪽인 4MB 까지만 받는다. 그보다 크면 드라이브를 연결해야 한다.
const FALLBACK_MAX = 4 * 1024 * 1024;

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, ...noStore });

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 한도를 크게 넘는 요청은 파싱 전에 거른다 (formData() 가 터져 500 이 되는 것 방지)
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > FALLBACK_MAX + 4096) return bad("드라이브 연결 없이는 4MB 이하만 올릴 수 있습니다.");

  let file: File | null;
  try {
    file = (await req.formData()).get("file") as File | null;
  } catch {
    return bad("파일을 읽지 못했습니다. 크기와 형식을 확인해주세요.");
  }
  if (!file) return bad("파일이 없습니다.");
  if (file.size === 0) return bad("빈 파일은 첨부할 수 없습니다.");
  if (file.size > FALLBACK_MAX) return bad("드라이브 연결 없이는 4MB 이하만 올릴 수 있습니다.");

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const rule = EXT_RULES[ext];
  if (!rule) return bad(`허용되지 않는 형식입니다. (가능: ${Object.keys(EXT_RULES).join(", ")})`);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!signatureOk(rule.group, buffer)) return bad("파일 내용이 확장자와 일치하지 않습니다.");

  try {
    // 저장 키에 원본 파일명을 쓰지 않는다. 원본명은 DB 메타데이터로만.
    const blob = await put(`notices/${randomUUID()}.${ext}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: rule.mime,
    });
    return NextResponse.json(
      { url: blob.url, name: file.name.slice(0, 255), size: file.size, mime: rule.mime },
      noStore,
    );
  } catch (e) {
    console.error("[upload-file/blob]", e);
    return bad("업로드 중 오류가 발생했습니다.", 500);
  }
}

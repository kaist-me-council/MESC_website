import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_MAX_MB, EXT_RULES, signatureOk } from "@/lib/upload-rules";

// 직접 업로드된 파일의 앞부분만 Range 로 받아 실제 형식을 확인한다.
// 확장자만 바꾼 파일이면 저장된 blob 을 지우고 거부한다.
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const url = typeof b.url === "string" ? b.url : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 255) : "";
  const size = Number(b.size);
  if (!BLOB_HOST.test(url)) return NextResponse.json({ error: "허용되지 않는 저장 위치입니다." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "파일 이름이 필요합니다." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "빈 파일은 첨부할 수 없습니다." }, { status: 400 });

  const drop = async () => { try { await del(url); } catch { /* 정리 실패는 무시 */ } };

  if (size > ATTACHMENT_MAX_SIZE) {
    await drop();
    return NextResponse.json({ error: `파일 크기는 ${ATTACHMENT_MAX_MB}MB 이하여야 합니다.` }, { status: 400 });
  }

  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const rule = EXT_RULES[ext];
  if (!rule) {
    await drop();
    return NextResponse.json({ error: `허용되지 않는 형식입니다. (가능: ${Object.keys(EXT_RULES).join(", ")})` }, { status: 400 });
  }

  try {
    const head = await fetch(url, { headers: { Range: "bytes=0-511" }, cache: "no-store" });
    if (!head.ok && head.status !== 206) throw new Error("fetch failed");
    const buf = Buffer.from(await head.arrayBuffer());
    if (!signatureOk(rule.group, buf)) {
      await drop();
      return NextResponse.json({ error: "파일 내용이 확장자와 일치하지 않습니다." }, { status: 400 });
    }
  } catch {
    await drop();
    return NextResponse.json({ error: "업로드한 파일을 확인하지 못했습니다. 다시 시도해주세요." }, { status: 400 });
  }

  return NextResponse.json({ url, name, size: Math.floor(size), mime: rule.mime });
}

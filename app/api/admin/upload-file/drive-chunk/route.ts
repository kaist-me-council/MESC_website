import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getAnonSalt } from "@/lib/anon";
import { EXT_RULES, signatureOk } from "@/lib/upload-rules";
import { deleteFile, fetchFileContent, getAccessTokenOrNull, getFileSize } from "@/lib/drive-oauth";
import { verifyUploadId } from "@/lib/upload-id";

// 첨부 업로드 2단계: 브라우저가 보낸 청크를 구글 드라이브 세션에 이어 붙인다.
// 본문은 청크 바이트 그대로, 위치 정보는 헤더로 받는다.
export const maxDuration = 60;

const noStore = { headers: { "Cache-Control": "private, no-store" } };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, ...noStore });

// Vercel 함수 본문 한도(4.5MB) 안쪽. 구글은 마지막이 아닌 청크가 256KB 배수일 것을 요구한다.
const CHUNK_MAX = 3 * 1024 * 1024; // 정확히 12 × 256KB
const CHUNK_UNIT = 256 * 1024;

/** 308 응답의 Range: bytes=0-N → 지금까지 받은 바이트 수 */
function receivedFrom(range: string | null, fallback: number): number {
  const m = range?.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : fallback;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticket = verifyUploadId(req.headers.get("x-upload-id"), getAnonSalt());
  if (!ticket) return bad("업로드 세션이 만료됐거나 올바르지 않습니다. 다시 시도해주세요.");

  const start = Number(req.headers.get("x-chunk-start"));
  const total = Number(req.headers.get("x-total-size"));
  if (!Number.isInteger(start) || start < 0 || start >= ticket.s) return bad("청크 위치가 올바르지 않습니다.");
  if (total !== ticket.s) return bad("파일 크기가 처음 신고한 값과 다릅니다.");

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0) return bad("빈 청크입니다.");
  if (body.length > CHUNK_MAX) return bad("청크가 너무 큽니다.", 413);
  if (start + body.length > ticket.s) return bad("청크가 신고한 크기를 넘습니다.");
  const isLast = start + body.length === ticket.s;
  // 마지막이 아닌 청크는 256KB 배수여야 구글이 받아 준다.
  if (!isLast && body.length % CHUNK_UNIT !== 0) return bad("청크 크기는 256KB 배수여야 합니다.");

  let res: Response;
  try {
    res = await fetch(ticket.u, {
      method: "PUT",
      // 308(Resume Incomplete)을 리다이렉트로 따라가지 않도록
      redirect: "manual",
      headers: {
        "Content-Type": ticket.m,
        "Content-Range": `bytes ${start}-${start + body.length - 1}/${ticket.s}`,
      },
      body: new Uint8Array(body),
    });
  } catch (e) {
    console.error("[drive-chunk] 전송 실패", e);
    return bad("구글 드라이브로 보내지 못했습니다. 다시 시도해주세요.", 502);
  }

  // 아직 남았다 — 구글이 알려 준 위치를 그대로 돌려줘 클라이언트가 맞춰 이어 보내게 한다.
  if (res.status === 308 || res.status === 0) {
    return NextResponse.json(
      { done: false, received: receivedFrom(res.headers.get("range"), start + body.length) },
      noStore,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[drive-chunk] 구글 응답", res.status, text.slice(0, 300));
    return bad("업로드가 거부됐습니다. 처음부터 다시 시도해주세요.", 502);
  }

  const uploaded = (await res.json().catch(() => ({}))) as { id?: string };
  const fileId = uploaded.id;
  if (!fileId) return bad("업로드는 끝났지만 파일 ID 를 받지 못했습니다. 다시 시도해주세요.", 502);

  // 완료 — 저장된 내용이 확장자와 맞는지 앞부분만 읽어 확인한다.
  const rule = EXT_RULES[(ticket.n.split(".").pop() ?? "").toLowerCase()];
  const tok = await getAccessTokenOrNull();
  if (!rule || !tok) return bad("업로드한 파일을 확인하지 못했습니다.", 502);

  const drop = async () => { await deleteFile(tok.accessToken, fileId); };
  try {
    const meta = await getFileSize(tok.accessToken, fileId);
    if (meta.size !== ticket.s) {
      await drop();
      return bad("업로드가 완전히 끝나지 않았습니다. 다시 시도해주세요.");
    }
    const head = await fetchFileContent(tok.accessToken, fileId, "bytes=0-511");
    if (!head.ok && head.status !== 206) throw new Error(`head ${head.status}`);
    if (!signatureOk(rule.group, Buffer.from(await head.arrayBuffer()))) {
      await drop();
      return bad("파일 내용이 확장자와 일치하지 않습니다.");
    }
  } catch (e) {
    console.error("[drive-chunk] 검증 실패", e);
    await drop();
    return bad("업로드한 파일을 확인하지 못했습니다. 다시 시도해주세요.");
  }

  await audit(session.user?.name ?? "unknown", "attachment.upload", `drive:${fileId}`, `${ticket.n} (${ticket.s}B)`);
  return NextResponse.json(
    { done: true, driveFileId: fileId, name: ticket.n, size: ticket.s, mime: ticket.m },
    noStore,
  );
}

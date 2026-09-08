import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";

// 공지 첨부파일 업로드 (관리자 전용).
// 이미지 전용인 /api/upload 와 달리 문서·압축 파일을 받는다. 확장자 allow-list + 실제 시그니처 검사.

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// 확장자 → 허용 시그니처 그룹. text 는 시그니처가 없어 내용으로 검사한다.
const EXT_RULES: Record<string, { group: "pdf" | "zip" | "ole" | "png" | "jpg" | "gif" | "webp" | "text"; mime: string }> = {
  pdf: { group: "pdf", mime: "application/pdf" },
  // 한글: hwpx·docx 계열은 zip 컨테이너, 구형 hwp·doc·xls·ppt 는 OLE2 복합문서
  hwpx: { group: "zip", mime: "application/haansofthwpx" },
  docx: { group: "zip", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { group: "zip", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { group: "zip", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  zip: { group: "zip", mime: "application/zip" },
  hwp: { group: "ole", mime: "application/x-hwp" },
  doc: { group: "ole", mime: "application/msword" },
  xls: { group: "ole", mime: "application/vnd.ms-excel" },
  ppt: { group: "ole", mime: "application/vnd.ms-powerpoint" },
  txt: { group: "text", mime: "text/plain" },
  csv: { group: "text", mime: "text/csv" },
  png: { group: "png", mime: "image/png" },
  jpg: { group: "jpg", mime: "image/jpeg" },
  jpeg: { group: "jpg", mime: "image/jpeg" },
  gif: { group: "gif", mime: "image/gif" },
  webp: { group: "webp", mime: "image/webp" },
};

const starts = (b: Buffer, bytes: number[]) => bytes.every((v, i) => b[i] === v);

/** 파일 앞부분이 확장자에 맞는 실제 형식인지 확인. 확장자만 바꾼 파일을 걸러낸다. */
function signatureOk(group: string, head: Buffer): boolean {
  switch (group) {
    case "pdf":
      return starts(head, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "zip":
      // PK\x03\x04 (일반) · PK\x05\x06 (빈 zip) · PK\x07\x08 (분할)
      return head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2] ?? -1);
    case "ole":
      return starts(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "png":
      return starts(head, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
      return starts(head, [0xff, 0xd8, 0xff]);
    case "gif":
      return starts(head, [0x47, 0x49, 0x46, 0x38]); // GIF8
    case "webp":
      return starts(head, [0x52, 0x49, 0x46, 0x46]) && head.subarray(8, 12).toString("latin1") === "WEBP";
    case "text":
      // 시그니처가 없으므로 제어문자(NUL 등)가 섞였는지로 판단
      return !head.subarray(0, 512).some((c) => c === 0);
    default:
      return false;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 본문을 버퍼링하기 전에 Content-Length 로 먼저 거른다.
  // (한도를 크게 넘는 요청은 formData() 파싱 자체가 실패해 500 이 되므로)
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_SIZE + 4096)
    return NextResponse.json({ error: "파일 크기는 20MB 이하여야 합니다." }, { status: 400 });

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "파일을 읽지 못했습니다. 크기(20MB 이하)와 형식을 확인해주세요." }, { status: 400 });
    }
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "빈 파일은 업로드할 수 없습니다." }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: "파일 크기는 20MB 이하여야 합니다." }, { status: 400 });

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const rule = EXT_RULES[ext];
    if (!rule)
      return NextResponse.json(
        { error: `허용되지 않는 형식입니다. (가능: ${Object.keys(EXT_RULES).join(", ")})` },
        { status: 400 },
      );

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!signatureOk(rule.group, buffer))
      return NextResponse.json({ error: "파일 내용이 확장자와 일치하지 않습니다." }, { status: 400 });

    // 저장 키에 원본 파일명을 쓰지 않는다 (경로 추측·정보 노출 방지). 원본명은 DB 메타데이터로만.
    const blob = await put(`notices/${randomUUID()}.${ext}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: rule.mime,
    });

    return NextResponse.json({
      url: blob.url,
      name: file.name.slice(0, 255),
      size: file.size,
      mime: rule.mime,
    });
  } catch {
    return NextResponse.json({ error: "업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}

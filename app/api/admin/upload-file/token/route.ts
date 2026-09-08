import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_MAX_MB, EXT_RULES } from "@/lib/upload-rules";

// 브라우저가 Blob 저장소로 직접 업로드할 때 쓰는 토큰 발급.
// 서버 함수를 거치지 않으므로 Vercel 의 4.5MB 본문 한도에 걸리지 않는다.
// 경로는 notices/<uuid>.<ext> 형태만 허용한다(원본 파일명은 저장 키에 쓰지 않음).
const PATHNAME = /^notices\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await auth())) throw new Error("Unauthorized");
        if (!PATHNAME.test(pathname)) throw new Error("잘못된 저장 경로입니다.");
        const ext = pathname.split(".").pop()!.toLowerCase();
        const rule = EXT_RULES[ext];
        if (!rule) throw new Error(`허용되지 않는 형식입니다. (가능: ${Object.keys(EXT_RULES).join(", ")})`);
        return {
          allowedContentTypes: [rule.mime, "application/octet-stream"],
          maximumSizeInBytes: ATTACHMENT_MAX_SIZE,
          addRandomSuffix: false,
        };
      },
      // 업로드 완료 콜백은 공개 URL 이 있어야 호출된다(로컬에서는 미호출).
      // 실제 내용 검증은 클라이언트가 이어서 호출하는 /verify 에서 한다.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "업로드 준비에 실패했습니다.";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg === "Unauthorized" ? "Unauthorized" : msg, maxMb: ATTACHMENT_MAX_MB }, { status });
  }
}

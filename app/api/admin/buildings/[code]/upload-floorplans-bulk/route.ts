import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureSubfolder, getAccessTokenOrNull, uploadFile, makePublic, DriveOAuthError } from "@/lib/drive-oauth";
import { floorplanFilename } from "@/lib/filename";
import { driveImageUrl } from "@/lib/drive";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_SIZE = 30 * 1024 * 1024;

function levelFromFilename(name: string): number | null {
  const m = name.match(/(\d+)\s*층/) || name.match(/[-_ ](\d+)F/i) || name.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const buildingCode = decodeURIComponent(code);

  const building = await prisma.building.findUnique({
    where: { code: buildingCode },
    include: { floors: true },
  });
  if (!building) return NextResponse.json({ error: `${buildingCode} 건물 없음` }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  try {
    const tok = await getAccessTokenOrNull();
    if (!tok?.auth.parentFolderId) {
      return NextResponse.json(
        { error: "Drive 연결+부모 폴더 설정이 필요합니다. /admin/events 에서 설정하세요." },
        { status: 400 },
      );
    }

    // 학생회 사이트 DB > 평면도 > {건물코드}
    const floorplansFolderId = await ensureSubfolder(tok.accessToken, tok.auth.parentFolderId, "평면도");
    const buildingFolderId = await ensureSubfolder(tok.accessToken, floorplansFolderId, buildingCode);

    const uploaded: { fileName: string; level: number; driveFileId: string }[] = [];
    const skipped: { fileName: string; reason: string }[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        skipped.push({ fileName: file.name, reason: `허용되지 않은 형식: ${file.type}` });
        continue;
      }
      if (file.size > MAX_SIZE) {
        skipped.push({ fileName: file.name, reason: "30MB 초과" });
        continue;
      }
      const level = levelFromFilename(file.name);
      if (!level) {
        skipped.push({ fileName: file.name, reason: "파일명에서 층 번호를 찾을 수 없음" });
        continue;
      }
      const floor = building.floors.find((f) => f.level === level);
      if (!floor) {
        skipped.push({ fileName: file.name, reason: `${level}층이 등록되지 않음` });
        continue;
      }

      // 파일명 규칙 적용 + Drive 업로드
      const renamedName = floorplanFilename(building.code, level, file.name);
      const buffer = await file.arrayBuffer();
      const renamed = new File([buffer], renamedName, { type: file.type });
      const up = await uploadFile(tok.accessToken, renamed, buildingFolderId);
      await makePublic(tok.accessToken, up.id).catch(() => {});

      const isPdf = file.type === "application/pdf";
      const imageUrl = isPdf
        ? `https://drive.google.com/thumbnail?id=${up.id}&sz=w2000`
        : driveImageUrl(up.id, 2000);

      await prisma.buildingFloor.update({
        where: { id: floor.id },
        data: { imageUrl, driveFileId: up.id },
      });
      uploaded.push({ fileName: file.name, level, driveFileId: up.id });
    }

    return NextResponse.json({ ok: true, buildingCode, uploaded, skipped });
  } catch (err) {
    if (err instanceof DriveOAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[upload-floorplans-bulk]", err);
    return NextResponse.json({ error: "업로드 중 오류" }, { status: 500 });
  }
}

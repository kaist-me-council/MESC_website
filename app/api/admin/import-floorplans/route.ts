import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAccessTokenOrNull, makePublic, DriveOAuthError } from "@/lib/drive-oauth";

/**
 * 관리자 전용. body: { folderUrl, buildingCode? }
 *
 * Drive 폴더 안의 "X층" 파일들을 자동으로 해당 BuildingFloor.imageUrl 에 매핑한다.
 * - 파일명에서 숫자+층 추출 (예: "기계공학동 3층.pdf" → 3)
 * - 그 파일을 makePublic 한 뒤 Drive thumbnail URL 을 BuildingFloor.imageUrl 에 저장
 * - 1F, 2F 이미 평면도가 있으면 덮어쓰지 않음 (옵션 force=true 면 덮어쓰기)
 */

function parseFolderId(input: string): string | null {
  const t = input.trim();
  const m = t.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(t)) return t;
  return null;
}

function levelFromFilename(name: string): number | null {
  // "기계공학동 3층.pdf", "3층 평면도.pdf", "N7-3F.pdf" 등 매칭
  const m = name.match(/(\d+)\s*층/) || name.match(/[-_ ](\d+)F/i);
  return m ? Number(m[1]) : null;
}

// Drive fetchDriveFolder 가 mimeType image/* 만 필터함 → PDF 도 같이 가져오려면 직접 호출 필요
async function listFolderFiles(accessToken: string, folderId: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
  url.searchParams.set("fields", "files(id,name,mimeType)");
  url.searchParams.set("pageSize", "1000");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const t = await res.text();
    throw new DriveOAuthError(`Drive 폴더 조회 실패 (${res.status}): ${t.slice(0, 200)}`, res.status);
  }
  const data = (await res.json()) as { files?: { id: string; name: string; mimeType: string }[] };
  return data.files ?? [];
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    folderUrl?: string;
    buildingCode?: string;
    force?: boolean;
  };
  const folderId = parseFolderId(body.folderUrl ?? "");
  if (!folderId) return NextResponse.json({ error: "올바른 Drive 폴더 URL/ID 가 필요합니다." }, { status: 400 });

  const buildingCode = body.buildingCode || "N7";
  const force = !!body.force;

  const building = await prisma.building.findUnique({
    where: { code: buildingCode },
    include: { floors: true },
  });
  if (!building) return NextResponse.json({ error: `${buildingCode} 건물을 찾을 수 없습니다.` }, { status: 404 });

  try {
    const tok = await getAccessTokenOrNull();
    if (!tok) return NextResponse.json({ error: "Drive 연결이 필요합니다. /admin/events 에서 인증하세요." }, { status: 400 });

    const files = await listFolderFiles(tok.accessToken, folderId);
    if (files.length === 0) return NextResponse.json({ error: "폴더에 파일이 없습니다." }, { status: 400 });

    const updated: { level: number; fileName: string; fileId: string }[] = [];
    const skipped: { level: number; reason: string }[] = [];
    const unmatched: string[] = [];

    for (const f of files) {
      const level = levelFromFilename(f.name);
      if (!level) {
        unmatched.push(f.name);
        continue;
      }
      const floor = building.floors.find((x) => x.level === level);
      if (!floor) {
        skipped.push({ level, reason: "해당 층이 등록되지 않음" });
        continue;
      }
      if (floor.imageUrl && !force) {
        skipped.push({ level, reason: "기존 평면도 유지 (force=true 로 덮어쓰기 가능)" });
        continue;
      }

      // 파일 공개 후 thumbnail URL 로 link
      await makePublic(tok.accessToken, f.id).catch(() => {});
      const isPdf = f.mimeType === "application/pdf";
      const imageUrl = isPdf
        ? `https://drive.google.com/thumbnail?id=${f.id}&sz=w2000`
        : `https://lh3.googleusercontent.com/d/${f.id}=w2000`;
      await prisma.buildingFloor.update({
        where: { id: floor.id },
        data: { imageUrl, driveFileId: f.id },
      });
      updated.push({ level, fileName: f.name, fileId: f.id });
    }

    return NextResponse.json({
      ok: true,
      building: buildingCode,
      updated,
      skipped,
      unmatched,
    });
  } catch (err) {
    if (err instanceof DriveOAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[import-floorplans]", err);
    return NextResponse.json({ error: "Import 중 오류" }, { status: 500 });
  }
}

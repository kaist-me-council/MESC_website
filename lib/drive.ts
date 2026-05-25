/**
 * Google Drive 폴더 동기화 유틸리티
 *
 * 공개 폴더("링크가 있는 모든 사용자가 보기")와 Drive API 키만 사용.
 * 서버 사이드에서만 호출 (API 라우트 안에서만 import).
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveFolderContents {
  folderName: string;
  files: DriveFile[];
}

export class DriveError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * Drive 폴더 URL 또는 raw ID 에서 폴더 ID 추출.
 *
 * 지원 형식:
 * - https://drive.google.com/drive/folders/{id}
 * - https://drive.google.com/drive/folders/{id}?usp=sharing
 * - https://drive.google.com/drive/u/0/folders/{id}
 * - raw id (영문/숫자/하이픈/언더스코어 25자 이상)
 */
export function parseFolderInput(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

/**
 * 폴더명에서 행사 날짜 / 제목 파싱.
 * 형식: `YYYY-MM-DD-제목` (예: "2026-05-10-신입생 환영회")
 */
export function parseFolderName(name: string): { date: Date; title: string } | null {
  const match = name.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (!match) return null;

  const [, y, m, d, title] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (isNaN(date.getTime())) return null;

  const cleanTitle = title.trim();
  if (!cleanTitle) return null;

  return { date, title: cleanTitle };
}

/**
 * Drive 이미지 표시 URL.
 * lh3.googleusercontent.com 썸네일 CDN 사용 (hotlink 안정적, virus-scan 없음).
 */
export function driveImageUrl(fileId: string, width = 1600): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

function getApiKey(): string {
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) {
    throw new DriveError("서버에 Drive API 키(GOOGLE_DRIVE_API_KEY)가 설정되지 않았습니다.", 500);
  }
  return key;
}

async function driveRequest(path: string, params: Record<string, string>): Promise<unknown> {
  const apiKey = getApiKey();
  const url = new URL(`${DRIVE_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (res.status === 404) {
    throw new DriveError("폴더를 찾을 수 없습니다. 폴더 ID와 공개 설정을 확인해주세요.", 404);
  }
  if (res.status === 403) {
    throw new DriveError(
      "폴더에 접근할 수 없습니다. '링크가 있는 모든 사용자가 보기'로 공유되어 있는지 확인해주세요.",
      403,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DriveError(`Drive API 오류 (${res.status}): ${text.slice(0, 200)}`, 502);
  }

  return res.json();
}

/**
 * 폴더 메타데이터 + 이미지 파일 목록 조회.
 * pageSize=1000 으로 한 번에 가져옴 (필요 시 nextPageToken 루프 추가).
 */
export async function fetchDriveFolder(folderId: string): Promise<DriveFolderContents> {
  const meta = (await driveRequest(`/files/${folderId}`, {
    fields: "id,name,mimeType",
  })) as { id?: string; name?: string; mimeType?: string };

  if (!meta?.name) {
    throw new DriveError("폴더 정보를 가져오지 못했습니다.", 502);
  }
  if (meta.mimeType !== "application/vnd.google-apps.folder") {
    throw new DriveError("입력한 ID가 폴더가 아닙니다.", 400);
  }

  const list = (await driveRequest("/files", {
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: "1000",
    orderBy: "name",
  })) as { files?: DriveFile[] };

  const files = (list.files ?? []).filter((f) => f.id && f.name && f.mimeType?.startsWith("image/"));

  return { folderName: meta.name, files };
}

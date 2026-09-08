/**
 * Google OAuth 2.0 + Drive API 래퍼
 *
 * 사용자 본인 계정으로 한 번 OAuth 인증 → refresh token DB 에 저장 →
 * 이후 서버에서 access token 자동 갱신하여 Drive 폴더/파일을 사용자 소유로 생성한다.
 */

import { prisma } from "@/lib/prisma";

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

// 필요한 scope: 사용자의 모든 Drive 파일 접근 (학생회 사이트 DB > 갤러리 폴더 등 기존 폴더에 쓰기 위해 필요)
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export class DriveOAuthError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function getClientCreds() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) {
    throw new DriveOAuthError(
      "GOOGLE_OAUTH_CLIENT_ID 또는 GOOGLE_OAUTH_CLIENT_SECRET 환경변수가 없습니다.",
      500,
    );
  }
  return { id, secret };
}

export function getRedirectUri(origin: string): string {
  const fromEnv = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  return `${origin}/api/auth/drive/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const { id } = getClientCreds();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForToken(code: string, origin: string): Promise<TokenResponse> {
  const { id, secret } = getClientCreds();
  const body = new URLSearchParams({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: getRedirectUri(origin),
    grant_type: "authorization_code",
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new DriveOAuthError(`토큰 교환 실패: ${text.slice(0, 200)}`, 502);
  return JSON.parse(text) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { id, secret } = getClientCreds();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret,
    grant_type: "refresh_token",
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DriveOAuthError(
      `토큰 갱신 실패. Drive 연결을 다시 인증해주세요. (${text.slice(0, 120)})`,
      401,
    );
  }
  const data = JSON.parse(text) as TokenResponse;
  return data.access_token;
}

/**
 * DB 에서 refresh token 을 가져와 access token 으로 교환한다.
 * DriveAuth 행이 없으면 null 반환 (호출자가 "연결 안 됨" 으로 처리).
 */
export async function getAccessTokenOrNull(): Promise<{ accessToken: string; auth: NonNullable<Awaited<ReturnType<typeof prisma.driveAuth.findUnique>>> } | null> {
  const auth = await prisma.driveAuth.findUnique({ where: { id: 1 } });
  if (!auth?.refreshToken) return null;
  const accessToken = await refreshAccessToken(auth.refreshToken);
  return { accessToken, auth };
}

async function driveFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  base: string = DRIVE_API_BASE,
): Promise<Response> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  return res;
}

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

/**
 * 부모 폴더 안에 새 폴더 생성.
 */
export async function createFolder(
  accessToken: string,
  name: string,
  parentId: string | null,
): Promise<DriveFolder> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await driveFetch(accessToken, "/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new DriveOAuthError(`폴더 생성 실패: ${text.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as DriveFolder;
}

/**
 * 폴더/파일을 "링크가 있는 모든 사용자가 보기" 로 공유 설정.
 * (이렇게 해야 lh3.googleusercontent.com 썸네일 URL 이 동작)
 */
export async function makePublic(accessToken: string, fileId: string): Promise<void> {
  const res = await driveFetch(accessToken, `/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new DriveOAuthError(`공유 권한 설정 실패: ${text.slice(0, 200)}`, res.status);
  }
}

export interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * multipart upload — 메타데이터 + 파일 본문을 한 번에.
 * @param file 브라우저 File 또는 Node Blob (둘 다 .name, .type, .arrayBuffer() 지원)
 */
export async function uploadFile(
  accessToken: string,
  file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> },
  parentId: string,
): Promise<UploadedFile> {
  const metadata = {
    name: file.name,
    parents: [parentId],
    mimeType: file.type || "application/octet-stream",
  };

  const boundary = `mesc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata,
  )}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;

  const body = Buffer.concat([Buffer.from(header, "utf8"), buf, Buffer.from(footer, "utf8")]);

  const res = await driveFetch(
    accessToken,
    "/files?uploadType=multipart&fields=id,name,mimeType",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    },
    DRIVE_UPLOAD_BASE,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new DriveOAuthError(`파일 업로드 실패: ${text.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as UploadedFile;
}

/**
 * 파일/폴더 메타데이터 조회 (이름 확인용).
 */
export async function getFileMeta(
  accessToken: string,
  fileId: string,
): Promise<{ id: string; name: string; mimeType: string }> {
  const res = await driveFetch(accessToken, `/files/${fileId}?fields=id,name,mimeType`);
  if (!res.ok) {
    const text = await res.text();
    throw new DriveOAuthError(`메타데이터 조회 실패: ${text.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as { id: string; name: string; mimeType: string };
}

/**
 * 폴더에서 폴더 ID 찾기 (이름으로 검색, 부모 폴더 안에서).
 * 없으면 null. mimeType: application/vnd.google-apps.folder
 */
export async function findSubfolder(
  accessToken: string,
  parentId: string,
  name: string,
): Promise<string | null> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1" });
  const res = await driveFetch(accessToken, `/files?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: { id: string; name: string }[] };
  return data.files?.[0]?.id ?? null;
}

/**
 * 부모 폴더 아래에 특정 이름의 하위 폴더가 있으면 그 ID 반환, 없으면 생성 후 공개 권한 설정.
 */
export async function ensureSubfolder(
  accessToken: string,
  parentId: string,
  name: string,
): Promise<string> {
  const existing = await findSubfolder(accessToken, parentId, name);
  if (existing) return existing;
  const created = await createFolder(accessToken, name, parentId);
  await makePublic(accessToken, created.id).catch(() => {});
  return created.id;
}

// ─────────────────────────────────────────────────────────────
// 공지 첨부파일용 — 브라우저에서 Drive 로 직접 올리고, 다운로드는 우리가 중계한다.
// (Vercel 서버리스 함수는 요청 본문이 4.5MB 로 제한돼 파일이 서버를 통과할 수 없다)
// ─────────────────────────────────────────────────────────────

/**
 * 부모 폴더 아래 하위 폴더 확보. ensureSubfolder 와 달리 공개 권한을 주지 않는다.
 * 첨부파일은 비공개로 두고 다운로드는 우리 API 가 중계한다.
 */
export async function ensurePrivateSubfolder(
  accessToken: string,
  parentId: string,
  name: string,
): Promise<string> {
  const existing = await findSubfolder(accessToken, parentId, name);
  if (existing) return existing;
  const created = await createFolder(accessToken, name, parentId);
  return created.id;
}

/**
 * 재개 가능(resumable) 업로드 세션 생성. 반환한 URI 로 브라우저가 직접 PUT 한다.
 * 세션 URI 자체가 단기 인증 토큰 역할을 하므로 access token 은 브라우저에 노출되지 않는다.
 */
export async function createResumableSession(
  accessToken: string,
  file: { name: string; mimeType: string; size: number },
  parentId: string,
): Promise<string> {
  const res = await driveFetch(
    accessToken,
    "/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.mimeType,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [parentId], mimeType: file.mimeType }),
    },
    DRIVE_UPLOAD_BASE,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new DriveOAuthError(`업로드 세션 생성 실패: ${text.slice(0, 200)}`, res.status);
  }
  const uri = res.headers.get("location");
  if (!uri) throw new DriveOAuthError("업로드 세션 URI 를 받지 못했습니다.", 502);
  return uri;
}

/** 파일 내용 조회. range 를 주면 앞부분만 받는다(시그니처 검사용). */
export async function fetchFileContent(
  accessToken: string,
  fileId: string,
  range?: string,
): Promise<Response> {
  return driveFetch(accessToken, `/files/${fileId}?alt=media`, {
    headers: range ? { Range: range } : {},
    cache: "no-store",
  });
}

/** 파일 크기까지 포함한 메타데이터. 업로드 검증에 쓴다. */
export async function getFileSize(
  accessToken: string,
  fileId: string,
): Promise<{ id: string; name: string; mimeType: string; size: number }> {
  const res = await driveFetch(accessToken, `/files/${fileId}?fields=id,name,mimeType,size`);
  if (!res.ok) {
    const text = await res.text();
    throw new DriveOAuthError(`메타데이터 조회 실패: ${text.slice(0, 200)}`, res.status);
  }
  const d = (await res.json()) as { id: string; name: string; mimeType: string; size?: string };
  return { ...d, size: Number(d.size ?? 0) };
}

/** 파일 삭제. 실패해도 호출자가 무시할 수 있게 boolean 반환. */
export async function deleteFile(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const res = await driveFetch(accessToken, `/files/${fileId}`, { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

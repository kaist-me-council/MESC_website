/**
 * 서버 전용 입력 검증 유틸리티
 * API 라우트에서만 사용
 */

// URL 허용 프로토콜 (javascript: 등 차단)
const ALLOWED_URL_PROTOCOLS = ["http:", "https:"];

/**
 * URL 유효성 검사 (javascript:/data: 등 위험 스키마 차단)
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 문자열 길이 및 타입 검사
 */
export function isValidString(value: unknown, maxLength = 1000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/**
 * 숫자 범위 검사
 */
export function isValidAmount(value: unknown): value is number {
  const n = Number(value);
  return !isNaN(n) && isFinite(n) && Math.abs(n) <= 1_000_000_000; // 10억 이하
}

/**
 * ID 파라미터 검사 (양의 정수)
 */
export function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return !isNaN(n) && n > 0 ? n : null;
}

/**
 * 날짜 검사
 */
export function isValidDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * 허용된 카테고리 값 검사
 */
export function isAllowedCategory(value: unknown, allowed: string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

/**
 * 공지 첨부파일 목록 검사.
 * 두 저장소를 허용한다: 우리 Blob(호스트 고정) 또는 구글 드라이브(파일 ID).
 * 그 외 URL 은 버린다 — 관리자가 실수/악의로 외부 링크를 첨부로 심는 것을 막는다.
 */
export interface AttachmentInput { id: number | null; name: string; url: string; driveFileId: string | null; size: number; mime: string }

const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

export function parseAttachments(value: unknown): AttachmentInput[] {
  if (!Array.isArray(value)) return [];
  const out: AttachmentInput[] = [];
  for (const raw of value.slice(0, 10)) {
    const a = raw as Record<string, unknown>;
    // 기존 행은 id 로 식별한다. id 가 있으면 저장 위치·이름은 DB 값을 쓰므로
    // 여기서 통과한 url/driveFileId 는 신규 행에만 쓰인다.
    const idNum = Number(a.id);
    const id = Number.isInteger(idNum) && idNum > 0 ? idNum : null;
    if (id !== null) { out.push({ id, name: "", url: "", driveFileId: null, size: 0, mime: "" }); continue; }
    if (!isValidString(a.name, 255)) continue;
    const driveFileId =
      typeof a.driveFileId === "string" && /^[A-Za-z0-9_-]{10,}$/.test(a.driveFileId.trim())
        ? a.driveFileId.trim()
        : null;
    const url = typeof a.url === "string" && BLOB_HOST.test(a.url) ? a.url : "";
    if (!driveFileId && !url) continue; // 저장 위치가 없으면 버린다
    const size = Number(a.size);
    out.push({
      id: null,
      name: a.name.trim().slice(0, 255),
      url,
      driveFileId,
      size: Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0,
      mime: typeof a.mime === "string" ? a.mime.slice(0, 100) : "application/octet-stream",
    });
  }
  return out;
}

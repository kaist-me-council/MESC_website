/**
 * 공지 첨부파일 형식 규칙 — 확장자 allow-list + 실제 시그니처 검사.
 *
 * Vercel 서버리스 함수는 요청 본문이 4.5MB 로 제한된다(초과 시 함수 실행 전에 413).
 * 그래서 파일은 브라우저에서 Blob 저장소로 직접 올리고(@vercel/blob/client),
 * 서버는 (1) 업로드 토큰을 낼 때 형식·크기를 제한하고
 *        (2) 업로드 후 앞부분 몇 바이트만 Range 로 받아 시그니처를 확인한다.
 */

export const ATTACHMENT_MAX_SIZE = 30 * 1024 * 1024; // 30MB
export const ATTACHMENT_MAX_MB = 30;

// 확장자 → 허용 시그니처 그룹. text 는 시그니처가 없어 내용으로 검사한다.
export const EXT_RULES: Record<string, { group: "pdf" | "zip" | "ole" | "png" | "jpg" | "gif" | "webp" | "text"; mime: string }> = {
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
export function signatureOk(group: string, head: Buffer): boolean {
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

/** 화면이 그대로 쓸 수 있는 다운로드 주소. Drive 는 우리 API 가 중계한다. */
export function attachmentDownloadUrl(a: { id: number; url: string; driveFileId: string | null }): string {
  return a.driveFileId ? `/api/notices/attachments/${a.id}` : a.url;
}

/** 공지 응답에 첨부 다운로드 주소를 붙인다. 화면은 저장소 종류를 몰라도 된다. */
export function withDownloadUrls<
  A extends { id: number; url: string; driveFileId: string | null },
  T extends { attachments: A[] },
>(notice: T) {
  return { ...notice, attachments: notice.attachments.map((a) => ({ ...a, downloadUrl: attachmentDownloadUrl(a) })) };
}

/** 첨부 목록 변경 계산 결과. */
export interface AttachmentDiff {
  /** 그대로 두는 기존 행 id */
  keepIds: number[];
  /** 새로 만들 행 (id 없는 항목) */
  toCreate: { name: string; url: string; driveFileId: string | null; size: number; mime: string }[];
  /** 지울 기존 행 id */
  toDeleteIds: number[];
  /** 이 공지 소유가 아닌 id — 있으면 요청을 거절한다 */
  foreignIds: number[];
}

/**
 * 들어온 목록과 기존 행을 비교해 유지·추가·삭제를 가른다.
 * 유지되는 행은 건드리지 않는다 — id 가 바뀌면 학생이 이미 받은 다운로드 주소가 죽는다.
 */
export function diffAttachments(
  existing: { id: number }[],
  incoming: { id: number | null; name: string; url: string; driveFileId: string | null; size: number; mime: string }[],
): AttachmentDiff {
  const existingIds = new Set(existing.map((e) => e.id));
  const keepIds: number[] = [];
  const foreignIds: number[] = [];
  const toCreate: AttachmentDiff["toCreate"] = [];

  for (const a of incoming) {
    if (a.id === null) {
      toCreate.push({ name: a.name, url: a.url, driveFileId: a.driveFileId, size: a.size, mime: a.mime });
    } else if (existingIds.has(a.id)) {
      if (!keepIds.includes(a.id)) keepIds.push(a.id);
    } else {
      foreignIds.push(a.id);
    }
  }

  const kept = new Set(keepIds);
  return { keepIds, toCreate, toDeleteIds: existing.map((e) => e.id).filter((id) => !kept.has(id)), foreignIds };
}

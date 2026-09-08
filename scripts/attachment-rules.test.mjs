// 실행: node scripts/attachment-rules.test.mjs
// 첨부 저장 위치 규칙 — 외부 링크 차단과 Drive/Blob 분기가 깨지면 여기서 실패한다.
import assert from "node:assert/strict";
import { parseAttachments } from "../lib/validation.ts";
import { attachmentDownloadUrl } from "../lib/upload-rules.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com/notices/a.pdf";
const base = { name: "a.pdf", size: 10, mime: "application/pdf" };

// Blob 행
assert.equal(parseAttachments([{ ...base, url: BLOB }]).length, 1);
assert.equal(parseAttachments([{ ...base, url: BLOB }])[0].driveFileId, null);

// Drive 행 (url 없음)
const drive = parseAttachments([{ ...base, url: "", driveFileId: "1AbCdEfGhIjK" }]);
assert.equal(drive.length, 1);
assert.equal(drive[0].driveFileId, "1AbCdEfGhIjK");
assert.equal(drive[0].url, "");

// 외부 URL 은 버린다 (저장 위치 없음)
assert.equal(parseAttachments([{ ...base, url: "https://evil.example.com/x.pdf" }]).length, 0);
// 외부 URL + 유효한 Drive ID → Drive 행으로 살리되 외부 URL 은 버린다
const mixed = parseAttachments([{ ...base, url: "https://evil.example.com/x.pdf", driveFileId: "1AbCdEfGhIjK" }]);
assert.equal(mixed.length, 1);
assert.equal(mixed[0].url, "");
// 형식이 틀린 Drive ID 는 무시
assert.equal(parseAttachments([{ ...base, url: "", driveFileId: "short" }]).length, 0);
// 이름 없으면 버린다
assert.equal(parseAttachments([{ url: BLOB, size: 1, mime: "application/pdf" }]).length, 0);
// 최대 10개
assert.equal(parseAttachments(Array(15).fill({ ...base, url: BLOB })).length, 10);

// 다운로드 주소 분기
assert.equal(attachmentDownloadUrl({ id: 7, url: BLOB, driveFileId: null }), BLOB);
assert.equal(attachmentDownloadUrl({ id: 7, url: "", driveFileId: "1AbCdEfGhIjK" }), "/api/notices/attachments/7");

console.log("attachment-rules: all assertions passed");

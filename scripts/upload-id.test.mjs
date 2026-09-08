// 실행: node scripts/upload-id.test.mjs
// 청크 업로드 티켓 서명·검증. 위조·만료·엉뚱한 호스트를 막는지만 본다.
import assert from "node:assert/strict";
import { signUploadId, verifyUploadId } from "../lib/upload-id.ts";

const SECRET = "test-secret";
const OTHER = "다른-비밀";
const now = 1_700_000_000_000;
const ok = {
  u: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=abc",
  n: "안내문.pdf",
  s: 12345,
  m: "application/pdf",
  e: now + 60_000,
};

// 왕복
const id = signUploadId(ok, SECRET);
assert.deepEqual(verifyUploadId(id, SECRET, now), ok);

// 한글 파일명이 깨지지 않는다
assert.equal(verifyUploadId(id, SECRET, now).n, "안내문.pdf");

// 다른 비밀키로는 통과 못 함
assert.equal(verifyUploadId(id, OTHER, now), null);

// 서명 위조
assert.equal(verifyUploadId(id.slice(0, id.lastIndexOf(".")) + ".forged", SECRET, now), null);

// 본문 변조 (세션 URI 를 남의 서버로 바꿔치기)
const evil = Buffer.from(JSON.stringify({ ...ok, u: "https://evil.example.com/x" }), "utf8").toString("base64url");
assert.equal(verifyUploadId(`${evil}.${id.split(".")[1]}`, SECRET, now), null);

// 서명까지 맞춰도 구글 호스트가 아니면 거부
assert.equal(verifyUploadId(signUploadId({ ...ok, u: "https://evil.example.com/x" }, SECRET), SECRET, now), null);

// 만료
assert.equal(verifyUploadId(signUploadId({ ...ok, e: now - 1 }, SECRET), SECRET, now), null);

// 형식 이상
assert.equal(verifyUploadId(signUploadId({ ...ok, s: 0 }, SECRET), SECRET, now), null);
assert.equal(verifyUploadId("", SECRET, now), null);
assert.equal(verifyUploadId("nodot", SECRET, now), null);
assert.equal(verifyUploadId(null, SECRET, now), null);
assert.equal(verifyUploadId(123, SECRET, now), null);

console.log("upload-id: all assertions passed");

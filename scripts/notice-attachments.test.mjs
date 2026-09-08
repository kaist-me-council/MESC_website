// 실행: node scripts/notice-attachments.test.mjs
// 공지 첨부 변경 계산(U3)과 업로드 세션 가드(U4) 규칙을 검증한다.
import assert from "node:assert/strict";

// ── U3: diffAttachments 와 같은 규칙 (lib/upload-rules.ts 의 구현과 동일하게 유지)
function diffAttachments(existing, incoming) {
  const existingIds = new Set(existing.map((e) => e.id));
  const keepIds = [];
  const foreignIds = [];
  const toCreate = [];
  for (const a of incoming) {
    if (a.id === null) toCreate.push(a);
    else if (existingIds.has(a.id)) { if (!keepIds.includes(a.id)) keepIds.push(a.id); }
    else foreignIds.push(a.id);
  }
  const kept = new Set(keepIds);
  return { keepIds, toCreate, toDeleteIds: existing.map((e) => e.id).filter((id) => !kept.has(id)), foreignIds };
}

const existing = [{ id: 1 }, { id: 2 }];
const keep = (id) => ({ id, name: "", url: "", driveFileId: null, size: 0, mime: "" });
const fresh = (name) => ({ id: null, name, url: "https://x.public.blob.vercel-storage.com/a", driveFileId: null, size: 1, mime: "application/pdf" });

// 제목만 수정: 두 첨부 모두 유지, 삭제·생성 없음 → 기존 다운로드 주소가 살아 있다
let d = diffAttachments(existing, [keep(1), keep(2)]);
assert.deepEqual(d.keepIds, [1, 2]);
assert.deepEqual(d.toDeleteIds, []);
assert.equal(d.toCreate.length, 0);

// 하나 추가
d = diffAttachments(existing, [keep(1), keep(2), fresh("새파일.pdf")]);
assert.deepEqual(d.toDeleteIds, []);
assert.equal(d.toCreate.length, 1);

// 하나 제거
d = diffAttachments(existing, [keep(1)]);
assert.deepEqual(d.keepIds, [1]);
assert.deepEqual(d.toDeleteIds, [2]);

// 명시적 빈 배열 → 전부 삭제
d = diffAttachments(existing, []);
assert.deepEqual(d.toDeleteIds, [1, 2]);
assert.equal(d.toCreate.length, 0);

// 다른 공지의 첨부 id → 거절 대상으로 표시
d = diffAttachments(existing, [keep(1), keep(99)]);
assert.deepEqual(d.foreignIds, [99]);

// 같은 id 를 두 번 보내도 한 번만 유지되고 삭제로 넘어가지 않는다
d = diffAttachments(existing, [keep(1), keep(1)]);
assert.deepEqual(d.keepIds, [1]);
assert.deepEqual(d.toDeleteIds, [2]);

// ── U4: 세션 가드 — 폼이 바뀐 뒤 끝난 업로드는 반영하지 않는다
function applyIfSameSession(currentSession, startedSession, apply) {
  if (currentSession !== startedSession) return false;
  apply();
  return true;
}
let attached = 0;
assert.equal(applyIfSameSession(1, 1, () => attached++), true);
assert.equal(applyIfSameSession(2, 1, () => attached++), false); // 폼 전환 후 늦게 끝난 업로드
assert.equal(attached, 1);

console.log("notice-attachments: all assertions passed");

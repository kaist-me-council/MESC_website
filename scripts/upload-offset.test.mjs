// 실행: node scripts/upload-offset.test.mjs  (Node 22.6+ type stripping)
// 청크 업로드가 서버 확인 위치만 믿는지 — 틀리면 파일이 조용히 깨진다.
import assert from "node:assert/strict";
import { nextChunkStart } from "../lib/upload-rules.ts";

const SIZE = 10 * 1024 * 1024;
const CHUNK = 3 * 1024 * 1024;

// 정상: 구글이 청크 전부를 받았다
assert.equal(nextChunkStart(CHUNK, CHUNK, SIZE), CHUNK);

// 핵심: 아무것도 못 받았다고 하면 되돌아가야 한다 (보낸 끝으로 전진 금지)
assert.equal(nextChunkStart(0, CHUNK, SIZE), 0);

// 일부만 받았다 → 그 위치부터
assert.equal(nextChunkStart(1_000_000, CHUNK, SIZE), 1_000_000);

// 뒤로 밀린 경우도 서버 말을 따른다
assert.equal(nextChunkStart(CHUNK, 2 * CHUNK, SIZE), CHUNK);

// 값이 없으면(구형 응답) 보낸 끝을 쓴다
assert.equal(nextChunkStart(undefined, CHUNK, SIZE), CHUNK);
assert.equal(nextChunkStart(null, CHUNK, SIZE), CHUNK);
assert.equal(nextChunkStart("3", CHUNK, SIZE), CHUNK);
assert.equal(nextChunkStart(NaN, CHUNK, SIZE), CHUNK);

// 범위를 벗어난 값은 잘라 낸다 — 루프가 파일 밖으로 나가지 않게
assert.equal(nextChunkStart(-5, CHUNK, SIZE), 0);
assert.equal(nextChunkStart(SIZE + 999, CHUNK, SIZE), SIZE);

// 진행 없음이 반복되면 호출부가 멈춰야 한다: 같은 값이 계속 나오는지 확인
let start = 0;
for (let i = 0; i < 3; i++) start = nextChunkStart(0, start + CHUNK, SIZE);
assert.equal(start, 0, "진행 없음이면 위치가 앞으로 가면 안 된다");

console.log("upload-offset: 모든 검사 통과");

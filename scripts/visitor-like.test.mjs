// 실행: node scripts/visitor-like.test.mjs
// V1 핵심 두 가지가 깨지면 여기서 실패한다.
//   ① 좋아요는 "목표 상태" 라 같은 요청을 반복해도 집계가 흔들리지 않는다.
//   ② 같은 탭에서 방문자 초기화는 한 번만 나간다(조회·좋아요가 서로 다른 토큰을 받지 않게).
import assert from "node:assert/strict";
import { likeAction } from "../lib/like-state.ts";
import { visitorReady, __resetVisitorInit } from "../lib/visitor-client.ts";

// ── ① 목표 상태 → 할 일
assert.equal(likeAction(false, true), "create");
assert.equal(likeAction(true, false), "delete");
// 이미 목표 상태면 집계를 건드리지 않는다 (응답 유실 후 재시도가 취소로 바뀌지 않는 근거)
assert.equal(likeAction(true, true), "none");
assert.equal(likeAction(false, false), "none");

// ── ② 같은 탭 공유 promise
const origFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async () => { calls++; return { ok: true }; };

__resetVisitorInit();
const results = await Promise.all([visitorReady(), visitorReady(), visitorReady()]);
assert.deepEqual(results, [true, true, true]);
assert.equal(calls, 1, `동시 호출 3회에 요청은 1회여야 하는데 ${calls}회`);

// 이미 확정된 뒤의 호출도 재요청하지 않는다
await visitorReady();
assert.equal(calls, 1, "확정 후 추가 요청이 나갔다");

// ── ③ 실패는 캐시하지 않는다 (다음 시도에서 다시 초기화할 수 있어야 한다)
__resetVisitorInit();
calls = 0;
globalThis.fetch = async () => { calls++; return { ok: false }; };
assert.equal(await visitorReady(), false);
assert.equal(await visitorReady(), false);
assert.equal(calls, 2, `실패는 캐시하면 안 되는데 요청이 ${calls}회`);

// 네트워크 예외도 false 로 (기록 보류)
__resetVisitorInit();
globalThis.fetch = async () => { throw new Error("offline"); };
assert.equal(await visitorReady(), false);

globalThis.fetch = origFetch;
console.log("visitor-like: all assertions passed");

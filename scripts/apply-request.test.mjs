// 실행: node scripts/apply-request.test.mjs
// 공개 화면 요청 헬퍼: 통신 실패(network/5xx/429)와 "결과 없음"이 절대 섞이지 않는지 고정한다.
import assert from "node:assert/strict";
import { request, errText, newIdemKey } from "../app/apply/[slug]/types.ts";

const t = (k) => k; // 키를 그대로 돌려주는 가짜 번역기
const fake = (impl) => { globalThis.fetch = impl; };

// 200 → ok, 본문 그대로
fake(async () => new Response(JSON.stringify({ orders: [] }), { status: 200 }));
const okEmpty = await request("/x");
assert.equal(okEmpty.ok, true);
assert.deepEqual(okEmpty.data, { orders: [] }); // 빈 목록은 "성공 + 0건"이지 실패가 아니다

// 네트워크 예외 → network
fake(async () => { throw new TypeError("Failed to fetch"); });
const net = await request("/x");
assert.equal(net.ok, false);
assert.equal(net.kind, "network");
assert.equal(net.status, 0);
assert.equal(errText(net, t), "apply.errNetwork");

// 429 → ratelimit
fake(async () => new Response(JSON.stringify({ error: "too many" }), { status: 429 }));
const rl = await request("/x");
assert.equal(rl.kind, "ratelimit");
assert.equal(errText(rl, t), "apply.errRateLimit"); // 서버 문구보다 안내 문구 우선

// 500 → server
fake(async () => new Response("boom", { status: 500 }));
const srv = await request("/x");
assert.equal(srv.kind, "server");
assert.equal(errText(srv, t), "apply.errServer"); // 본문이 JSON 이 아니어도 죽지 않는다

// 4xx → client, 서버 메시지 우선, 본문 보존(재고 409 의 optionId 등)
fake(async () => new Response(JSON.stringify({ error: "재고 부족", optionId: 7 }), { status: 409 }));
const cli = await request("/x");
assert.equal(cli.kind, "client");
assert.equal(cli.status, 409);
assert.equal(errText(cli, t), "재고 부족");
assert.equal(cli.body.optionId, 7);

// 4xx 인데 error 없음 → 기본 문구
fake(async () => new Response(JSON.stringify({}), { status: 400 }));
assert.equal(errText(await request("/x"), t), "apply.genericError");

// 재전송 키: 매번 달라야 하고 8자 이상
const k1 = newIdemKey(), k2 = newIdemKey();
assert.notEqual(k1, k2);
assert.ok(k1.length >= 8);

console.log("apply-request: all assertions passed");

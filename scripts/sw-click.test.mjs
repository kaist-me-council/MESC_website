// 실행: node scripts/sw-click.test.mjs
// 알림 클릭이 "관련 없는 탭을 이동시키지 않는지" 확인한다.
// public/sw.js 는 서비스 워커라 import 할 수 없어, 파일에서 순수 함수 두 개만 떼어내 평가한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name} 을 sw.js 에서 찾지 못함`);
  // 함수 선언부터 같은 들여쓰기의 닫는 중괄호까지
  const end = src.indexOf("\n}", start);
  assert.ok(end !== -1, `${name} 의 끝을 찾지 못함`);
  return src.slice(start, end + 2);
}

const ORIGIN = "https://mesc-website.vercel.app";
const factory = new Function(
  "self",
  `${extract("resolveTarget")}\n${extract("pickClient")}\nreturn { resolveTarget, pickClient };`
);
const { resolveTarget, pickClient } = factory({ location: { origin: ORIGIN } });

// ── resolveTarget: 같은 origin 만 통과 ──
assert.equal(resolveTarget("/notices/3"), `${ORIGIN}/notices/3`);
assert.equal(resolveTarget(`${ORIGIN}/apply`), `${ORIGIN}/apply`);
assert.equal(resolveTarget(undefined), `${ORIGIN}/`);
assert.equal(resolveTarget(""), `${ORIGIN}/`);
// 다른 origin 은 홈으로 — 알림으로 외부 사이트를 열지 않는다
assert.equal(resolveTarget("https://evil.example.com/x"), `${ORIGIN}/`);
assert.equal(resolveTarget("javascript:alert(1)"), `${ORIGIN}/`);

// ── pickClient: 정확히 일치하는 탭만 고른다 ──
const target = `${ORIGIN}/notices/3`;
const editing = { url: `${ORIGIN}/admin/notices` }; // 작성 중인 관리자 탭
const other = { url: `${ORIGIN}/apply/tshirt` };
const exact = { url: target };

// 대상 탭이 있으면 그 탭
assert.equal(pickClient([editing, other, exact], target), exact);
// 없으면 null → 호출부가 새 창을 연다. 작성 중인 탭을 절대 고르지 않는다.
assert.equal(pickClient([editing, other], target), null);
assert.equal(pickClient([], target), null);
// 쿼리스트링이 다르면 다른 탭이다 (부분 일치로 남의 탭을 잡지 않는다)
assert.equal(pickClient([{ url: `${target}?from=push` }], target), null);

// ── 회귀 방지: navigate 를 다시 넣으면 실패한다 ──
const clickHandler = src.slice(src.indexOf('addEventListener("notificationclick"'));
assert.ok(!clickHandler.includes(".navigate("), "notificationclick 이 다시 navigate 를 호출한다");

console.log("sw-click: all assertions passed");

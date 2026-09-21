// 실행: node scripts/deposit-match.test.mjs
// 입금 대조가 "확실한 것만 자동, 나머지는 사람에게" 를 지키는지 본다.
import assert from "node:assert/strict";
import { parseDeposits, matchDeposits } from "../lib/deposit-match.ts";

// ── 파싱: 은행마다 칸 순서가 다르다
const lines = parseDeposits(`
2026.09.22 14:03\t홍길동\t"5,000"\t"1,234,567"
2026-09-22,김철수,5000,90000
이영희,5000
입금\t박민수\t10,000\t2,000,000
그냥 아무 말
`);
assert.deepEqual(lines.map((l) => [l.name, l.amount]), [
  ["홍길동", 5000],
  ["김철수", 5000],
  ["이영희", 5000],
  ["박민수", 10000],
], JSON.stringify(lines));

// 잔액(마지막 숫자)을 금액으로 잘못 집지 않는다
assert.equal(parseDeposits("2026.09.22\t홍길동\t5,000\t9,999,999")[0].amount, 5000);
// "입금" 같은 머리말은 이름이 아니다
assert.equal(lines[3].name, "박민수");

// ── 대조
const targets = [
  { id: 1, name: "홍길동", total: 5000 },
  { id: 2, name: "김철수", depositorName: "김아버지", total: 5000 },
  { id: 3, name: "이영희", total: 8000 },
  { id: 4, name: "박민수", total: 10000 },
  { id: 5, name: "박민수", total: 10000 }, // 동명이인
];
const r = matchDeposits(lines, targets);

// 이름·금액 일치 + 후보 하나 → 자동 처리 대상
// (2번은 입금자명이 "김아버지" 로 적혀 있어도 신청자 이름 "김철수" 로 들어온 입금과 맞는다)
assert.deepEqual(r.matched.map((m) => m.orderId), [1, 2]);
// 금액이 다르면 자동 처리하지 않는다
assert.deepEqual(r.amountMismatch.map((m) => [m.orderId, m.expected]), [[3, 8000]]);
// 동명이인은 사람이 고른다
assert.deepEqual(r.ambiguous.map((m) => m.orderIds), [[4, 5]]);
assert.deepEqual(r.unmatched.map((l) => l.name), []);

// 입금자명으로도 찾는다
const r2 = matchDeposits(parseDeposits("김아버지,5000"), targets);
assert.deepEqual(r2.matched.map((m) => m.orderId), [2]);

// 같은 신청 건이 두 입금 줄에 중복으로 걸리지 않는다
const r3 = matchDeposits(parseDeposits("홍길동,5000\n홍길동,5000"), [{ id: 1, name: "홍길동", total: 5000 }]);
assert.equal(r3.matched.length, 1);
assert.equal(r3.unmatched.length, 1);

// 명단에 없는 입금
const r4 = matchDeposits(parseDeposits("최낯선,5000"), targets);
assert.deepEqual(r4.unmatched.map((l) => l.name), ["최낯선"]);

console.log("deposit-match: all assertions passed");

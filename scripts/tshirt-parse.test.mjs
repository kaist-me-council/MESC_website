// 실행: node scripts/tshirt-parse.test.mjs  (Node 22.6+ type stripping)
import assert from "node:assert/strict";
import { parseItemText, parseCsv, parseDistributionCsv } from "../lib/tshirt-parse.ts";

const it = (s) => parseItemText(s, "black").items.map((i) => `${i.size}x${i.qty}`).join(",");
assert.equal(it("XL 1개"), "XLx1");
assert.equal(it("XL"), "XLx1");
assert.equal(it("M 1개 / L 1개"), "Mx1,Lx1");
assert.equal(it("XL 1개 / 2XL 3개"), "XLx1,2XLx3");
assert.equal(it("S 1개 / 2XL 2개 / 3XL 1개"), "Sx1,2XLx2,3XLx1");
assert.equal(it("2XL 1개 --> XL 1개로 수정"), "XLx1");
assert.equal(parseItemText("2XL 1개 --> XL 1개로 수정", "white").note, "원래 2XL 1개");
assert.equal(it("2XL 1개 (환불처리)"), "2XLx1");
assert.equal(parseItemText("2XL 1개 (환불처리)", "white").note, "환불처리");
assert.equal(it("XL(LL) 2"), "XLx2");
assert.equal(it("SS 1개"), "Sx1");
assert.deepEqual(parseItemText("", "white"), { items: [], note: null, unparsed: [] });
assert.deepEqual(parseItemText("아무거나", "white").unparsed, ["아무거나"]);

assert.deepEqual(parseCsv('a,"b, c","d""e"\n1,2,3\r\n'), [["a", "b, c", 'd"e'], ["1", "2", "3"]]);

const csv = [
  "구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무,,메일",
  '학부생,홍길동,20250001,01000000000,Hong@kaist.ac.kr,XL 1개,L 2개,신예승,TRUE,,"a@x, b@y"',
  "교수님,김교수,,01011111111,prof@kaist.ac.kr,,M 1개,,FALSE,,",
  "대학원생,이상한,20250002,,odd@kaist.ac.kr,모름,L 1개,,FALSE,,",
].join("\n");
const { rows, problems } = parseDistributionCsv(csv, (sid) => `h(${sid})`);
assert.equal(rows.length, 3);
assert.equal(rows[0].studentIdHash, "h(20250001)");
assert.equal(rows[0].email, "hong@kaist.ac.kr");
assert.equal(rows[0].pickedUp, true);
assert.equal(rows[0].handedBy, "신예승");
assert.equal(rows[1].handedBy, null);
assert.deepEqual(rows[0].items, [{ color: "white", size: "XL", qty: 1 }, { color: "black", size: "L", qty: 2 }]);
assert.equal(rows[1].studentIdHash, null);
assert.equal(rows[1].pickedUp, false);
assert.equal(problems.length, 1);
assert.match(problems[0], /4행 이상한/);
console.log("tshirt-parse: all assertions passed");

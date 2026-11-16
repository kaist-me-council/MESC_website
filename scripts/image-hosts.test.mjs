// 실행: node scripts/image-hosts.test.mjs  (Node 22.6+ type stripping)
import assert from "node:assert/strict";
import { isAllowedImageUrl } from "../lib/image-hosts.ts";

assert.ok(isAllowedImageUrl("https://8cfs9sx0idnxlf4q.public.blob.vercel-storage.com/a.jpg"));
assert.ok(isAllowedImageUrl("https://lh3.googleusercontent.com/d/abc"));
assert.ok(isAllowedImageUrl("https://me.kaist.ac.kr/img/p.jpg"));
assert.ok(!isAllowedImageUrl("http://me.kaist.ac.kr/img/p.jpg"), "http 거부");
assert.ok(!isAllowedImageUrl("https://evil.com/x.jpg"), "미허용 호스트 거부");
assert.ok(!isAllowedImageUrl("https://me.kaist.ac.kr.evil.com/x.jpg"), "접미 위장 거부");
assert.ok(!isAllowedImageUrl("https://public.blob.vercel-storage.com.evil.com/x"), "와일드카드 위장 거부");
assert.ok(!isAllowedImageUrl("not a url"));
console.log("image-hosts ok");

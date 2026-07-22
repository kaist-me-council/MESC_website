// 기계공학동(N7) 평면도 + 교수 핀 반영 상태 검증 (assert 기반).
//   (a) 1~7층 모두 imageUrl 존재 + PNG 파일 실존
//   (b) 모든 교수 posX/posY 가 0~1 범위
//   (c) 층별 배치/미배치 교수 수 출력
// 사용: node scripts/floorplan-pins.check.mjs
import { createClient } from "@libsql/client";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = createClient({ url: process.env.DATABASE_URL || "file:./dev.db" });

const bid = (await db.execute("SELECT id FROM Building WHERE name='기계공학동'")).rows[0].id;

// (a) 7개 층 imageUrl + 파일 실존
const floors = (await db.execute({
  sql: "SELECT id, level, imageUrl FROM BuildingFloor WHERE buildingId=? ORDER BY level",
  args: [bid],
})).rows;
assert.equal(floors.length, 7, `기계공학동 층 수 7 != ${floors.length}`);
for (const f of floors) {
  assert.ok(f.imageUrl, `${f.level}층 imageUrl 없음`);
  const path = join(root, "public", f.imageUrl);
  assert.ok(existsSync(path), `PNG 파일 없음: ${path}`);
}

// (b),(c) 교수 좌표 범위 + 층별 집계
const profs = (await db.execute({
  sql: "SELECT p.name, f.level, p.posX, p.posY FROM Professor p " +
       "JOIN BuildingFloor f ON p.floorId=f.id WHERE p.buildingId=?",
  args: [bid],
})).rows;

const byFloor = new Map();
for (const p of profs) {
  const s = byFloor.get(p.level) || { placed: 0, unplaced: [] };
  if (p.posX != null && p.posY != null) {
    assert.ok(p.posX >= 0 && p.posX <= 1, `${p.name} posX 범위 이탈: ${p.posX}`);
    assert.ok(p.posY >= 0 && p.posY <= 1, `${p.name} posY 범위 이탈: ${p.posY}`);
    s.placed++;
  } else {
    s.unplaced.push(p.name);
  }
  byFloor.set(p.level, s);
}

console.log("층 | 배치 | 미배치");
for (const lvl of [...byFloor.keys()].sort((a, b) => a - b)) {
  const s = byFloor.get(lvl);
  const u = s.unplaced.length ? `  (${s.unplaced.join(", ")})` : "";
  console.log(`${lvl}층 | ${s.placed} | ${s.unplaced.length}${u}`);
}
const placed = profs.filter((p) => p.posX != null).length;
console.log(`\n총 교수 ${profs.length}, 배치 ${placed}, 미배치 ${profs.length - placed}`);
console.log("OK: 7개 층 이미지 실존, 모든 좌표 0~1 범위");

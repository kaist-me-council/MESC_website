// data/kaist-me-professors.json → Professor 모델 시드.
//   멱등: Professor 는 unique 키가 없어 name+email 존재 체크 후 update/create.
//   Office 가 N7 이면 Building(N7)·BuildingFloor(층)·Room(호실) 을 최대한 연결.
//
// 사용:
//   node scripts/seed-professors.mjs
//   (로컬: DATABASE_URL=file:./dev.db / Turso: DATABASE_URL + TURSO_AUTH_TOKEN)
//   ※ N7 건물/호실 연결을 원하면 scripts/seed-rooms.mjs 를 먼저 실행할 것.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "..", "data", "kaist-me-professors.json");

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter });

function nz(s, max) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  return max && t.length > max ? t.slice(0, max) : t;
}

const professors = JSON.parse(await readFile(DATA, "utf8"));
// order = 이름 가나다순
professors.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));

// N7 건물 + 층 캐시
const n7 = await prisma.building.findUnique({ where: { code: "N7" } });
if (!n7) console.warn("[seed-professors] ⚠ Building 'N7' 없음 — 호실 연결 생략 (seed-rooms.mjs 먼저 실행 권장)");
const floorCache = new Map();
async function n7Floor(level) {
  if (!n7) return null;
  if (floorCache.has(level)) return floorCache.get(level);
  const f = await prisma.buildingFloor.findUnique({
    where: { buildingId_level: { buildingId: n7.id, level } },
  });
  floorCache.set(level, f);
  return f;
}

let created = 0;
let updated = 0;
let linkedBuilding = 0;
let linkedFloor = 0;
let linkedRoom = 0;

for (let i = 0; i < professors.length; i++) {
  const p = professors[i];
  const office = p.office || {};
  const roomNumber = nz(office.roomNumber, 20);

  let buildingId = null;
  let floorId = null;
  let roomId = null;

  if (n7 && office.isN7 && roomNumber) {
    buildingId = n7.id;
    linkedBuilding++;
    const level = Number(roomNumber[0]);
    if (Number.isInteger(level)) {
      const floor = await n7Floor(level);
      if (floor) {
        floorId = floor.id;
        linkedFloor++;
        const room = await prisma.room.findUnique({
          where: { floorId_code: { floorId: floor.id, code: roomNumber } },
        });
        if (room) {
          roomId = room.id;
          linkedRoom++;
        }
      }
    }
  }

  const data = {
    name: nz(p.name, 50) || `교수 ${p.uid}`,
    nameEn: nz(p.nameEn, 100),
    title: nz(p.title, 30) || "교수",
    email: nz(p.email, 200),
    phone: nz(p.phone, 50),
    researchArea: nz(p.researchArea, 200),
    websiteUrl: nz(p.websiteUrl, 500),
    imageUrl: nz(p.imageUrl, 500),
    buildingId,
    floorId,
    roomNumber,
    roomId,
    order: i,
  };

  // name+email 기준 존재 체크
  const existing = await prisma.professor.findFirst({
    where: { name: data.name, email: data.email },
  });
  if (existing) {
    await prisma.professor.update({ where: { id: existing.id }, data });
    updated++;
  } else {
    await prisma.professor.create({ data });
    created++;
  }
}

console.log(
  `[seed-professors] 완료 — 신규 ${created}명, 갱신 ${updated}명 (총 ${professors.length})`
);
console.log(
  `  연결: building=${linkedBuilding}, floor=${linkedFloor}, room=${linkedRoom}`
);
await prisma.$disconnect();

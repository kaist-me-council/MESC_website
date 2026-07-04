// data/kaist-me-courses.json → Course 모델 시드 (code 기준 upsert, 멱등).
//
// 사용:
//   node scripts/seed-courses.mjs
//   (로컬: DATABASE_URL=file:./dev.db / Turso: DATABASE_URL + TURSO_AUTH_TOKEN)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "..", "data", "kaist-me-courses.json");

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter });

// 빈 문자열 → null, 길이 제한 적용
function nz(s, max) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  return max && t.length > max ? t.slice(0, max) : t;
}

// ME.2xxxx→"200", 3xxxx→"300", 4xxxx→"400", 그 외(1/9 등)→"기타"
function levelFromCode(code) {
  const d = (code.match(/ME\.(\d)/) || [])[1];
  if (d === "2") return "200";
  if (d === "3") return "300";
  if (d === "4") return "400";
  return "기타";
}

const courses = JSON.parse(await readFile(DATA, "utf8"));
courses.sort((a, b) => a.code.localeCompare(b.code)); // order = 코드 순

let created = 0;
let updated = 0;
for (let i = 0; i < courses.length; i++) {
  const c = courses[i];
  const data = {
    name: nz(c.name) || c.code,
    nameEn: nz(c.nameEn),
    level: levelFromCode(c.code),
    description: nz(c.description),
    descriptionEn: nz(c.descriptionEn),
    youtubeUrl: nz(c.youtubeUrl),
    order: i,
  };
  const existing = await prisma.course.findUnique({ where: { code: c.code } });
  await prisma.course.upsert({
    where: { code: c.code },
    create: { code: c.code, ...data },
    update: data,
  });
  if (existing) updated++;
  else created++;
}

console.log(`[seed-courses] 완료 — 신규 ${created}개, 갱신 ${updated}개 (총 ${courses.length})`);
await prisma.$disconnect();

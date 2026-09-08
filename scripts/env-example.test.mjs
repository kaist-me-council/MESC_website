#!/usr/bin/env node
/**
 * 코드가 읽는 환경변수와 .env.example 이 어긋나지 않는지 확인한다.
 *
 * 왜: .env.example 에 빠진 변수는 "빌드는 성공하고 기능만 조용히 죽는" 형태로
 * 나타난다. 실제로 VAPID 4종(푸시 전체)과 CRON_SECRET(주간 백업+개인정보 파기)이
 * 누락된 채 방치돼 있었다. 새 담당자가 example 만 보고 세팅하면 그대로 재현된다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN = ["app", "lib", "components", "scripts", "prisma"];

/** 런타임이 자동 주입하거나 문서화할 필요가 없는 변수 */
const IGNORED = new Set([
  "NODE_ENV",
  "VERCEL_ENV", // Vercel 주입
  "VERCEL_GIT_COMMIT_SHA", // Vercel 주입
  "SITE_URL", // verify-deploy.mjs 의 선택적 인자
  "ICON_PREVIEW", // 로컬 아이콘 생성 스크립트 전용
  "VAPID_PUBLIC_KEY", // NEXT_PUBLIC_VAPID_PUBLIC_KEY 의 폴백
]);

/** 코드에 리터럴로 안 나타나지만 반드시 설정해야 하는 변수 (SDK 가 암묵 사용) */
const IMPLICIT = new Set([
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "BLOB_READ_WRITE_TOKEN",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

const used = new Set();
for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
  }
}

const example = readFileSync(join(ROOT, ".env.example"), "utf8");
const documented = new Set(
  [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1])
);

const missing = [...used].filter((v) => !documented.has(v) && !IGNORED.has(v)).sort();
const dead = [...documented].filter((v) => !used.has(v) && !IMPLICIT.has(v)).sort();

assert.deepStrictEqual(
  missing,
  [],
  `코드가 읽는데 .env.example 에 없는 변수: ${missing.join(", ")}\n` +
    `→ .env.example 에 추가하고 "없으면 무엇이 죽는지" 주석을 달 것.`
);

assert.deepStrictEqual(
  dead,
  [],
  `.env.example 에만 있고 코드가 안 쓰는 변수: ${dead.join(", ")}\n` +
    `→ 제거하거나, SDK 가 암묵 사용하는 것이면 이 파일의 IMPLICIT 에 추가할 것.`
);

console.log(`env-example: 코드 참조 ${used.size}개 / 문서화 ${documented.size}개 — 일치`);

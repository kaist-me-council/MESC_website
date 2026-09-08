#!/usr/bin/env node
/**
 * 배포된 커밋이 로컬 HEAD 와 같은지 확인한다.
 *
 * 병합했는데 라이브에 반영이 안 되는 사고(2026-09-08 ignoreCommand 사고)를
 * 사람이 눈치채기 전에 잡기 위한 것. 병합·배포 후 이거 한 번만 돌리면 된다.
 *
 *   npm run verify:deploy
 *   npm run verify:deploy -- https://다른-도메인
 *
 * 배포 전파에 시간이 걸리므로 최대 5분간 15초 간격으로 재시도한다.
 */
import { execSync } from "node:child_process";

const SITE = process.argv[2] ?? process.env.SITE_URL ?? "https://mesc-website.vercel.app";
const DEADLINE = Date.now() + 5 * 60 * 1000;

const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
console.log(`로컬 HEAD : ${head}`);
console.log(`대상       : ${SITE}/api/health`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

while (true) {
  let body;
  try {
    const res = await fetch(`${SITE}/api/health`, { cache: "no-store" });
    body = await res.json();
  } catch (e) {
    body = { error: e instanceof Error ? e.message : String(e) };
  }

  if (body.commit === head) {
    if (body.db !== "ok") {
      console.error(`\n✗ 커밋은 맞지만 DB 연결이 실패했습니다: ${JSON.stringify(body)}`);
      process.exit(1);
    }
    console.log(`\n✓ 배포 확인 — commit ${body.commit.slice(0, 7)}, env=${body.env}, db=${body.db}`);
    process.exit(0);
  }

  if (Date.now() > DEADLINE) {
    console.error(`\n✗ 5분 동안 반영되지 않았습니다. 서빙 중: ${JSON.stringify(body)}`);
    console.error("  → Vercel 배포가 Canceled/Error 인지 확인: npx vercel ls");
    process.exit(1);
  }

  process.stdout.write(".");
  await sleep(15_000);
}

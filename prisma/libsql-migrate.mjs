// 빌드 시 prisma/migrations 의 SQL을 Turso libSQL 에 직접 적용한다.
// `prisma migrate deploy` 는 libsql:// 스킴을 인식하지 못해 (P1013) 사용 불가.
// 멱등성: 이미 적용된 문장(중복 컬럼/테이블)은 무시하고 진행.

import { createClient } from "@libsql/client";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dbUrl = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || dbUrl.startsWith("file:")) {
  console.log("[libsql-migrate] DATABASE_URL 가 비어있거나 file: 입니다. 빌드 시 마이그레이션 스킵 (로컬은 prisma migrate dev 사용).");
  process.exit(0);
}

const db = createClient({ url: dbUrl, ...(authToken ? { authToken } : {}) });

await db.execute(`
  CREATE TABLE IF NOT EXISTS _libsql_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )
`);

const migDir = "prisma/migrations";
if (!existsSync(migDir)) {
  console.log("[libsql-migrate] migrations 디렉토리 없음. 종료.");
  process.exit(0);
}

const folders = readdirSync(migDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const appliedRes = await db.execute("SELECT id FROM _libsql_migrations");
const applied = new Set(appliedRes.rows.map((r) => r.id));

// 기록되지 않은 모든 마이그레이션을 순서대로 적용한다.
// 이미 존재하는 객체(테이블/컬럼/인덱스)는 isAlreadyExistsError 로 건너뛰므로
// 빈 DB / 부분 적용 DB 어느 쪽이든 안전하게 수렴한다.

// (과거 디버깅: 잘못 적용된 마이그레이션 강제 재실행 — 모두 처리되어 비움)
const FORCE_REAPPLY = [];
for (const id of FORCE_REAPPLY) {
  if (applied.has(id)) {
    console.log(`[libsql-migrate] force-reapply: ${id} 기록 삭제`);
    await db.execute({ sql: "DELETE FROM _libsql_migrations WHERE id = ?", args: [id] });
    applied.delete(id);
  }
}

const isAlreadyExistsError = (msg) =>
  /already exists|duplicate column|duplicate index/i.test(String(msg));

// SQL 파일을 statement 단위로 분리.
// 1) 라인별로 주석 제거 후 합치고 2) `;` 로 분리.
function parseStatements(rawSql) {
  const stripped = rawSql
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--"))
    .join(" ");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

let appliedCount = 0;
for (const folder of folders) {
  if (applied.has(folder)) continue;

  const sqlPath = join(migDir, folder, "migration.sql");
  if (!existsSync(sqlPath)) continue;

  const sql = readFileSync(sqlPath, "utf8");
  const statements = parseStatements(sql);

  console.log(`[libsql-migrate] 적용: ${folder} (${statements.length} statements)`);
  for (const stmt of statements) {
    try {
      await db.execute(stmt);
    } catch (err) {
      if (isAlreadyExistsError(err?.message)) {
        console.log(`  ↳ skip (이미 존재): ${stmt.slice(0, 60)}...`);
        continue;
      }
      console.error(`  ↳ 실패: ${stmt.slice(0, 80)}...`);
      throw err;
    }
  }
  await db.execute({ sql: "INSERT INTO _libsql_migrations(id) VALUES (?)", args: [folder] });
  appliedCount++;
}

console.log(`[libsql-migrate] 완료 (신규 ${appliedCount}개 적용)`);

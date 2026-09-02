#!/usr/bin/env node
// 사용: node scripts/decrypt-backup.mjs backup-2026-09-02.json.enc "$CRON_SECRET" > backup.json
// 형식: [12바이트 iv][암호문][16바이트 GCM 태그], 키 = sha256(CRON_SECRET)
import { readFileSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";

const [file, secret] = process.argv.slice(2);
if (!file || !secret) {
  console.error("usage: decrypt-backup.mjs <file.json.enc> <CRON_SECRET>");
  process.exit(1);
}
const buf = readFileSync(file);
const iv = buf.subarray(0, 12);
const tag = buf.subarray(buf.length - 16);
const data = buf.subarray(12, buf.length - 16);
const d = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
d.setAuthTag(tag);
process.stdout.write(Buffer.concat([d.update(data), d.final()]));

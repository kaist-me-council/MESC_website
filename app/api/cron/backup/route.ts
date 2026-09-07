import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Vercel Cron (vercel.json) 이 주 1회 호출. 전 테이블을 JSON으로 덤프해 Blob에 저장.
// ponytail: sqlite_master 동적 열거 — 모델 하드코딩 대비 스키마 변경 시 누락 위험 없음.
//
// 덤프에는 Drive refresh token·비밀번호 해시·건의 연락처가 포함되므로 AES-256-GCM 으로 암호화한다.
// 키 = sha256(CRON_SECRET). 복호화: `node scripts/decrypt-backup.mjs <file> <CRON_SECRET>`.
// 같은 호출에서 개인정보 보유기간 정리도 수행한다(아래 purgeExpired).

const DAY = 24 * 60 * 60 * 1000;

async function purgeExpired() {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY);
  const d90 = new Date(now - 90 * DAY);
  const d180 = new Date(now - 180 * DAY);
  // 건의 연락처: 답변 후 30일 지나면 파기
  await prisma.suggestion.updateMany({
    where: { respondedAt: { lt: d30 }, contactInfo: { not: null } },
    data: { contactInfo: null },
  });
  // IP 해시: 90일 지나면 제거 (어뷰징 대응 창 종료)
  const old = { where: { createdAt: { lt: d90 }, ipHash: { not: null } }, data: { ipHash: null } };
  await prisma.post.updateMany(old);
  await prisma.comment.updateMany(old);
  await prisma.suggestion.updateMany(old);
  await prisma.courseReview.updateMany(old);
  // 신고 기록: 180일 지나면 삭제
  await prisma.report.deleteMany({ where: { createdAt: { lt: d180 } } });
  // 학생회 이벤트 신청: 캠페인 마감(closesAt) 후 180일 지나면 개인정보만 익명화 (주문 항목·금액·상태는 통계용으로 보존)
  await prisma.campaignOrder.updateMany({
    where: { campaign: { closesAt: { lt: d180 } }, email: { not: "" } },
    data: { name: "(익명화)", email: "", phone: null, studentIdHash: null, depositorName: null, note: null, confirmNote: null, adminMemo: null },
  });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await purgeExpired();

    const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' AND name NOT LIKE '_libsql%'`
    );

    const dump: Record<string, unknown[]> = {};
    for (const { name } of tables) {
      dump[name] = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}"`);
    }

    const json = Buffer.from(JSON.stringify(dump), "utf8");
    const key = createHash("sha256").update(secret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([iv, cipher.update(json), cipher.final(), cipher.getAuthTag()]);

    const date = new Date().toISOString().slice(0, 10);
    // Blob 스토어는 public(행사 사진용) — 내용이 암호화돼 있어 URL 노출로는 복호화 불가.
    const blob = await put(`backups/backup-${date}.json.enc`, body, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });

    return NextResponse.json({ ok: true, tables: tables.length, bytes: body.length, pathname: blob.pathname });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

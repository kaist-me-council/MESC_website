import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * 웹 푸시 발송 (서버 전용).
 *
 * 구독은 브라우저마다 하나이고, 아이폰은 홈 화면에 추가한 상태에서만 구독이 생긴다.
 * 발송 실패는 호출부로 던지지 않는다 — 공지 등록이 알림 때문에 실패하면 안 된다.
 */

const MAX_FAIL = 5;

let configured = false;

/** VAPID 설정. 환경변수가 없으면 여기서만 throw 한다(발송 시점). */
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID 환경변수 미설정 — NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT 를 설정하세요."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  pruned: number;
}

/**
 * 모든 구독에 발송. 만료(404/410)된 구독은 삭제하고, 그 밖의 실패는 failCount 를 올린다.
 * ponytail: 전체를 한 번에 fan-out — 구독이 수천 개가 되면 청크로 나눌 것.
 */
export async function sendPushToAll(payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  try {
    configure();
  } catch (e) {
    console.error("[push] 설정 실패", e instanceof Error ? e.message : e);
    return result;
  }

  let subs: { id: number; endpoint: string; p256dh: string; auth: string; failCount: number }[];
  try {
    subs = await prisma.pushSubscription.findMany({
      select: { id: true, endpoint: true, p256dh: true, auth: true, failCount: true },
    });
  } catch (e) {
    console.error("[push] 구독 조회 실패", e instanceof Error ? e.message : e);
    return result;
  }
  if (subs.length === 0) return result;

  const json = JSON.stringify(payload);
  const gone: number[] = [];
  const failed: number[] = [];
  const ok: number[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json
        );
        ok.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else failed.push(s.id);
      }
    })
  );

  try {
    if (ok.length) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: ok } },
        data: { lastSuccessAt: new Date(), failCount: 0 },
      });
    }
    if (gone.length) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    }
    if (failed.length) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: failed } },
        data: { failCount: { increment: 1 } },
      });
      // 연속 실패가 한도를 넘은 구독은 정리
      const dead = await prisma.pushSubscription.deleteMany({
        where: { id: { in: failed }, failCount: { gte: MAX_FAIL } },
      });
      result.pruned += dead.count;
    }
  } catch (e) {
    console.error("[push] 구독 정리 실패", e instanceof Error ? e.message : e);
  }

  result.sent = ok.length;
  result.failed = failed.length + gone.length;
  result.pruned += gone.length;
  return result;
}

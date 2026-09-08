import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * 웹 푸시 발송 (서버 전용).
 *
 * 구독은 브라우저마다 하나이고, 아이폰은 홈 화면에 추가한 상태에서만 구독이 생긴다.
 * 발송 실패는 호출부로 던지지 않는다 — 공지 등록이 알림 때문에 실패하면 안 된다.
 * 대신 status 로 "미설정 / 조회 실패 / 구독자 없음 / 일부 실패 / 완료" 를 구분해 돌려준다.
 * (예전에는 셋 다 {sent:0,failed:0,pruned:0} 이라 정상 0건과 실패를 구분할 수 없었다.)
 */

const MAX_FAIL = 5;
const SEND_TIMEOUT_MS = 10_000; // 요청 하나당
const TOTAL_TIMEOUT_MS = 25_000; // 전체 fan-out 상한 — UI busy 가 반드시 풀리도록

let configured = false;

/** VAPID 설정. 환경변수가 없으면 여기서만 throw 한다(발송 시점). */
function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("vapid-missing");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * not_configured : VAPID 환경변수 미설정 → 관리자가 조치해야 함
 * lookup_failed  : 구독 DB 조회 실패 → 일시 장애, 재시도 대상
 * no_subscribers : 정상인데 받을 사람이 없음
 * partial        : 일부 실패 (failed > 0)
 * sent           : 전부 성공
 */
export type PushStatus = "not_configured" | "lookup_failed" | "no_subscribers" | "partial" | "sent";

export interface PushResult {
  status: PushStatus;
  sent: number;
  failed: number;
  pruned: number;
  /** 안전한 오류 코드만. endpoint·토큰·내부 예외 원문은 담지 않는다. */
  code?: "vapid-missing" | "db-unavailable" | "timeout";
}

/** 시간 상한을 넘으면 거부 — web-push 가 매달려 있어도 응답은 돌아가게. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

/**
 * 모든 구독에 발송. 만료(404/410)된 구독은 삭제하고, 그 밖의 실패는 failCount 를 올린다.
 * ponytail: 전체를 한 번에 fan-out — 구독이 수천 개가 되면 청크로 나눌 것.
 */
export async function sendPushToAll(payload: PushPayload): Promise<PushResult> {
  const empty = { sent: 0, failed: 0, pruned: 0 };
  try {
    configure();
  } catch (e) {
    console.error("[push] 설정 실패", e instanceof Error ? e.message : e);
    return { status: "not_configured", code: "vapid-missing", ...empty };
  }

  let subs: { id: number; endpoint: string; p256dh: string; auth: string }[];
  try {
    subs = await prisma.pushSubscription.findMany({
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch (e) {
    console.error("[push] 구독 조회 실패", e instanceof Error ? e.message : e);
    return { status: "lookup_failed", code: "db-unavailable", ...empty };
  }
  if (subs.length === 0) return { status: "no_subscribers", ...empty };

  const json = JSON.stringify(payload);
  const gone: number[] = [];
  const failed: number[] = [];
  const ok: number[] = [];
  let timedOut = false;

  const fanOut = Promise.allSettled(
    subs.map(async (s) => {
      try {
        await withTimeout(
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            json
          ),
          SEND_TIMEOUT_MS
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
    await withTimeout(fanOut, TOTAL_TIMEOUT_MS);
  } catch {
    // 상한 초과 — 그때까지 확정된 결과만 반영하고 나머지는 실패로 센다.
    timedOut = true;
  }

  let pruned = 0;
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
      pruned += dead.count;
    }
  } catch (e) {
    console.error("[push] 구독 정리 실패", e instanceof Error ? e.message : e);
  }

  const unresolved = timedOut ? subs.length - ok.length - failed.length - gone.length : 0;
  const failedCount = failed.length + gone.length + unresolved;
  return {
    status: failedCount > 0 ? "partial" : "sent",
    sent: ok.length,
    failed: failedCount,
    pruned: pruned + gone.length,
    ...(timedOut ? { code: "timeout" as const } : {}),
  };
}

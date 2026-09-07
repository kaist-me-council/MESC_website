import { prisma } from "@/lib/prisma";

/**
 * 관리자 행위 감사 로그. 개인정보 원문·CSV 본문은 남기지 않는다(건수·상태 요약만).
 *
 * 절대 throw 하지 않는다 — 로그 실패 때문에 본 작업이 실패하면 안 된다.
 * 호출부는 `void audit(...)` 로 결과를 기다리지 않아도 된다.
 */
export async function audit(actor: string, action: string, target: string, detail?: string) {
  try {
    await prisma.adminAudit.create({
      data: {
        actor: actor.slice(0, 100),
        action: action.slice(0, 50),
        target: target.slice(0, 100),
        detail: detail?.slice(0, 300) || null,
      },
    });
  } catch (e) {
    console.error("[audit] 기록 실패", action, target, e instanceof Error ? e.message : e);
  }
}

"use client";

/**
 * 방문자 쿠키가 확정된 뒤에만 조회·좋아요를 보내기 위한 공통 초기화.
 *
 * 같은 탭: 모듈 수준 promise 하나를 공유해 /api/visitor 를 한 번만 부른다.
 * 다른 탭: Web Locks 로 최초 진입을 직렬화한다. 잠금을 얻은 뒤 서버가 기존 쿠키를
 *          다시 확인하므로(멱등) 두 번째 탭은 첫 탭이 구운 쿠키를 그대로 쓴다.
 *
 * 남는 한계: Web Locks 가 없는 브라우저(구형 Safari 등)에서는 탭 사이 경합이 그대로 남는다.
 *            그 경우 마지막 Set-Cookie 가 이기고 진 쪽 기록이 고아가 될 수 있다.
 *            같은 탭 promise 만으로 두 탭 문제까지 해결되지는 않는다.
 */

let inflight: Promise<boolean> | null = null;

async function callInit(): Promise<boolean> {
  try {
    const res = await fetch("/api/visitor", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

type WithLocks = { locks?: { request: (name: string, fn: () => Promise<boolean>) => Promise<boolean> } };

/** 방문자 쿠키가 준비되면 true. false 면 기록을 보류하고 나중에 다시 시도한다. */
export function visitorReady(): Promise<boolean> {
  if (inflight) return inflight;

  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & WithLocks).locks : undefined;
  const started = locks ? locks.request("mesc-visitor-init", callInit).catch(callInit) : callInit();

  // 실패는 캐시하지 않는다 — 다음 시도에서 다시 초기화할 수 있어야 한다.
  inflight = started.then((ok) => {
    if (!ok) inflight = null;
    return ok;
  });
  return inflight;
}

/** 테스트용 — 모듈 캐시 초기화. */
export function __resetVisitorInit() {
  inflight = null;
}

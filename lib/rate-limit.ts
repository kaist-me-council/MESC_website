/**
 * 가벼운 IP+버킷 기반 rate-limit (메모리 맵).
 *
 * Vercel 서버리스의 multi-instance 환경에서는 인스턴스마다 별도 카운터를 유지하므로
 * 완벽하지 않다 (실제 한도 = 설정값 × 인스턴스 수). 그래도 일반적인 봇/도배 공격은
 * 충분히 차단한다. 더 엄격한 보호가 필요하면 Vercel KV / Upstash 같은 외부 저장소로
 * 교체하면 된다.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// 주기적인 청소 (만료된 키 제거) — 메모리 누수 방지
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number; // ms
}

/**
 * @param ip 클라이언트 IP (또는 식별자)
 * @param bucket 버킷 이름 (라우트별로 다르게)
 * @param max 윈도우 안에서 허용되는 최대 요청 수
 * @param windowMs 윈도우 길이 (ms)
 */
export function enforce(ip: string, bucket: string, max: number, windowMs: number): RateLimitResult {
  maybeCleanup();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs, retryAfter: 0 };
  }

  if (existing.count >= max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt, retryAfter: existing.resetAt - now };
  }

  existing.count++;
  return {
    ok: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
    retryAfter: 0,
  };
}

/** 버킷 카운터를 지운다 (로그인 성공 시 실패 카운터 초기화 등). */
export function reset(ip: string, bucket: string): void {
  store.delete(`${bucket}:${ip}`);
}

/**
 * Request 에서 IP 를 추출. Vercel/CDN 환경에서는 x-forwarded-for 첫 번째 값.
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

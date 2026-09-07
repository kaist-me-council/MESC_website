/* 공개 화면 공용 요청 헬퍼.

   통신 실패(network/5xx/429)와 "결과가 비어 있음"을 절대 섞지 않기 위해,
   모든 fetch 를 성공/실패 판별 결과로 바꾼다. 문구는 렌더 시점에 errText 로
   만든다(여기서 t 를 받으면 useCallback 의존성이 매 렌더 바뀐다). */

export type T = (k: string) => string;

export type FailKind = "network" | "ratelimit" | "client" | "server";
export interface ReqFail { ok: false; kind: FailKind; status: number; error?: string; body: Record<string, unknown> }
export type ReqResult<D> = { ok: true; data: D } | ReqFail;

export async function request<D>(url: string, init?: RequestInit): Promise<ReqResult<D>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false, kind: "network", status: 0, body: {} };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, data: body as D };
  const kind: FailKind = res.status === 429 ? "ratelimit" : res.status >= 500 ? "server" : "client";
  return { ok: false, kind, status: res.status, error: typeof body.error === "string" ? body.error : undefined, body };
}

/** 실패 종류 → 사용자 문구. 4xx 는 서버가 준 메시지를 우선한다. */
export const errText = (f: ReqFail, t: T) =>
  f.kind === "network" ? t("common.errNetwork")
    : f.kind === "ratelimit" ? t("common.errRateLimit")
      : f.kind === "server" ? t("common.errServer")
        : f.error ?? t("common.genericError");

/** 재전송 방지 키. crypto.randomUUID 가 없는 환경(비보안 컨텍스트)도 대비. */
export const newIdemKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

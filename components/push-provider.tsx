"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * 푸시 구독 상태를 앱 전체에서 하나로 소유한다.
 *
 * 왜 provider 인가: 공지 페이지와 푸터에 토글이 각각 있는데 예전에는 컴포넌트마다 상태를
 * 따로 들고 있어서 한쪽에서 켜도 다른 쪽은 옛 상태로 남았다(P4). 또 브라우저 구독만 보고
 * "켜짐"을 표시해, 서버 등록이 실패해도 켜진 것처럼 보였다(P1).
 *
 * 그래서 두 가지를 분리해서 다룬다.
 *   - 브라우저에 subscription 이 있는가
 *   - 그 endpoint 가 서버에 등록되어 있는가
 * 서버 확인 전에는 절대 "on" 으로 표시하지 않는다.
 */

export type PushPhase =
  | "loading"
  | "unsupported" // 브라우저가 푸시를 지원하지 않음
  | "insecure" // https 가 아님
  | "ios-install" // iOS 인데 홈 화면 앱이 아님
  | "denied" // 사용자가 차단함
  | "off"
  | "on"
  | "register-failed"; // 브라우저 구독은 있으나 서버 등록 실패 → 재시도 필요

interface PushState {
  phase: PushPhase;
  busy: boolean;
  error: string;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  retry: () => Promise<void>;
}

const Ctx = createContext<PushState | null>(null);

const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ 는 데스크톱 UA 를 쓴다
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

/** base64url VAPID 공개키 → Uint8Array */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** 빌드 시점에 주입된 공개키가 없으면 서버에서 받아온다(환경변수를 나중에 넣은 경우). */
async function vapidKey(): Promise<string> {
  const inlined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (inlined) return inlined;
  const r = await fetch("/api/push/key");
  if (!r.ok) return "";
  return ((await r.json()) as { key?: string }).key ?? "";
}

/** 서버에 endpoint 를 등록(멱등 upsert). 성공 여부만 돌려준다. */
async function registerOnServer(sub: PushSubscription): Promise<boolean> {
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PushProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<PushPhase>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 사용자가 명시적으로 조작할 때마다 증가. 초기 동기화가 늦게 끝나도
  // 그 사이 사용자가 끈 상태를 되살리지 않는다.
  const opSeq = useRef(0);
  const inited = useRef(false);

  /** 최초 1회 동기화. 새로 subscribe 하지 않고, 이미 있는 구독만 서버에 재등록한다. */
  const init = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return setPhase("insecure");
    const pushable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    // iOS 는 홈 화면 앱이 아니면 위 API 자체가 없다 → 설치 안내로 분기
    if (!pushable) return setPhase(isIos() && !isStandalone() ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setPhase("denied");

    const seq = opSeq.current;
    let sub: PushSubscription | null | undefined;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      sub = await reg?.pushManager.getSubscription();
    } catch {
      sub = null;
    }
    if (seq !== opSeq.current) return; // 그 사이 사용자가 켜거나 껐다
    if (!sub) return setPhase("off");

    // 브라우저 구독이 있어도 서버에 없을 수 있다 → 멱등 재등록으로 확인.
    const ok = await registerOnServer(sub);
    if (seq !== opSeq.current) return;
    setPhase(ok ? "on" : "register-failed");
  }, []);

  useEffect(() => {
    if (inited.current) return; // 토글이 여러 개 마운트돼도 동기화는 한 번
    inited.current = true;
    Promise.resolve().then(init);
  }, [init]);

  const enable = useCallback(async () => {
    const seq = ++opSeq.current;
    setBusy(true);
    setError("");
    try {
      const key = await vapidKey();
      if (!key) throw new Error("not-configured");
      // 권한 요청은 반드시 사용자 클릭 안에서 (iOS 요구사항)
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        if (seq === opSeq.current) setPhase(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        }));
      const ok = await registerOnServer(sub);
      if (seq !== opSeq.current) return; // 도중에 사용자가 껐다면 그 결정을 존중
      if (!ok) {
        setPhase("register-failed");
        setError("save-failed");
        return;
      }
      setPhase("on");
    } catch (e) {
      if (seq !== opSeq.current) return;
      setError(e instanceof Error && e.message === "not-configured" ? "not-configured" : "save-failed");
      setPhase("off"); // 서버 확인 전에는 on 으로 돌아가지 않는다
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    const seq = ++opSeq.current;
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      if (seq === opSeq.current) setPhase("off");
    } catch {
      if (seq === opSeq.current) setError("save-failed");
    } finally {
      setBusy(false);
    }
  }, []);

  /** 서버 등록만 다시 시도 — 브라우저 구독은 그대로 두고 권한도 다시 묻지 않는다. */
  const retry = useCallback(async () => {
    const seq = ++opSeq.current;
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        if (seq === opSeq.current) setPhase("off");
        return;
      }
      const ok = await registerOnServer(sub);
      if (seq !== opSeq.current) return;
      setPhase(ok ? "on" : "register-failed");
      if (!ok) setError("save-failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return <Ctx.Provider value={{ phase, busy, error, enable, disable, retry }}>{children}</Ctx.Provider>;
}

export function usePush(): PushState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePush 는 PushProvider 안에서만 쓸 수 있습니다.");
  return v;
}

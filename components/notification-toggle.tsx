"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { Bell, BellOff, BellRing, Share, Plus, X } from "lucide-react";

/**
 * 공지 알림 구독 토글.
 *
 * 아이폰 주의: iOS Safari 는 "홈 화면에 추가"로 설치한 상태(standalone)에서만
 * Notification·PushManager 가 존재한다. 설치 전에는 버튼을 눌러도 아무 일이 없으므로
 * 버튼 대신 설치 방법을 안내한다. (권한 요청은 반드시 클릭 안에서 호출해야 한다.)
 */

type State =
  | "loading"
  | "unsupported" // 브라우저가 푸시를 지원하지 않음
  | "insecure" // https 가 아님
  | "ios-install" // iOS 인데 홈 화면 앱이 아님
  | "denied" // 사용자가 차단함
  | "off"
  | "on";

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

export function NotificationToggle({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const detect = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return setState("insecure");
    const pushable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    // iOS 는 홈 화면 앱이 아니면 위 API 자체가 없다 → 설치 안내로 분기
    if (!pushable) return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(detect);
  }, [detect]);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error(t("push.notConfigured"));
      // 권한 요청은 이 클릭 핸들러 안에서 (iOS 요구사항)
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
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
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!res.ok) throw new Error(t("push.saveFailed"));
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("push.saveFailed"));
      await detect();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
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
      setState("off");
    } catch {
      setError(t("push.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported" || state === "insecure") return null;

  if (state === "ios-install") {
    return (
      <Alert className={`rounded-2xl ${className}`}>
        <Bell className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">{t("push.iosTitle")}</p>
          <ol className="list-decimal pl-4 space-y-0.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1 flex-wrap">
              <Share className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t("push.iosStep1")}</span>
            </li>
            <li className="flex items-center gap-1 flex-wrap">
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t("push.iosStep2")}</span>
            </li>
            <li>{t("push.iosStep3")}</li>
          </ol>
        </AlertDescription>
      </Alert>
    );
  }

  if (state === "denied") {
    return (
      <Alert className={`rounded-2xl ${className}`}>
        <BellOff className="h-4 w-4" />
        <AlertDescription className="text-xs">{t("push.deniedNote")}</AlertDescription>
      </Alert>
    );
  }

  const on = state === "on";
  return (
    <div className={className}>
      <Button
        type="button"
        variant={on ? "secondary" : "outline"}
        size="sm"
        disabled={busy}
        onClick={on ? disable : enable}
        className="h-11 rounded-xl gap-2"
      >
        {on ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}
        {busy ? t("push.working") : on ? t("push.on") : t("push.off")}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** 안드로이드·데스크톱 설치 유도 배너. iOS 는 beforeinstallprompt 가 없어 위 컴포넌트가 안내한다. */
export function InstallPrompt({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const [evt, setEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("pwa-install-dismissed") === "1";
    } catch {
      /* 저장소 접근 불가 — 배너를 계속 보여 준다 */
    }
    if (dismissed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem("pwa-install-dismissed", "1");
    } catch {
      /* 무시 */
    }
    setEvt(null);
  };

  if (!evt) return null;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 ${className}`}>
      <Bell className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
      <span className="text-sm flex-1">{t("push.installHint")}</span>
      <Button size="sm" className="h-9 rounded-lg" onClick={() => { void evt.prompt(); setEvt(null); }}>
        {t("push.install")}
      </Button>
      <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={dismiss} aria-label={t("push.dismiss")}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

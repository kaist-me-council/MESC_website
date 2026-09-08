"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { usePush } from "@/components/push-provider";
import { Bell, BellOff, BellRing, Share, Plus, X, RotateCw } from "lucide-react";

/**
 * 공지 알림 구독 토글. 상태는 PushProvider 가 소유한다 —
 * 공지 페이지와 푸터에 각각 놓여도 같은 상태·busy·오류를 공유한다.
 *
 * 아이폰 주의: iOS Safari 는 "홈 화면에 추가"로 설치한 상태(standalone)에서만
 * Notification·PushManager 가 존재한다. 설치 전에는 버튼을 눌러도 아무 일이 없으므로
 * 버튼 대신 설치 방법을 안내한다. (권한 요청은 반드시 클릭 안에서 호출해야 한다.)
 */
export function NotificationToggle({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { phase, busy, error, enable, disable, retry } = usePush();

  if (phase === "loading" || phase === "unsupported" || phase === "insecure") return null;

  if (phase === "ios-install") {
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

  if (phase === "denied") {
    return (
      <Alert className={`rounded-2xl ${className}`}>
        <BellOff className="h-4 w-4" />
        <AlertDescription className="text-xs">{t("push.deniedNote")}</AlertDescription>
      </Alert>
    );
  }

  // 브라우저 구독은 있으나 서버 등록이 안 된 상태. "켜짐" 으로 보여 주지 않는다.
  if (phase === "register-failed") {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={retry}
          className="h-11 rounded-xl gap-2"
        >
          <RotateCw className="h-4 w-4" />
          {busy ? t("push.working") : t("push.retry")}
        </Button>
        <p className="mt-1 text-xs text-destructive">{t("push.registerFailed")}</p>
      </div>
    );
  }

  const on = phase === "on";
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
      {error && (
        <p className="mt-1 text-xs text-destructive">
          {error === "not-configured" ? t("push.notConfigured") : error === "timeout" ? t("push.timeout") : t("push.saveFailed")}
        </p>
      )}
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

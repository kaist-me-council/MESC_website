"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 프로덕션에서는 외부 로깅(Sentry 등) 연동 지점
    console.error(error);
  }, [error]);

  return (
    <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 tech-mesh opacity-20 -z-10" />
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive mx-auto">
          <AlertTriangle className="h-9 w-9" />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            문제가 발생했습니다
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
            일시적인 오류로 페이지를 표시하지 못했습니다. 잠시 후 다시 시도해 주세요.
            <br className="hidden sm:block" />
            <span className="text-muted-foreground/70 text-sm">
              Something went wrong. Please try again.
            </span>
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-muted-foreground/50">
              오류 코드: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-bold transition-all hover:bg-primary/80 active:translate-y-px"
          >
            <RotateCcw className="h-4 w-4" />
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg border border-border bg-background text-sm font-bold transition-all hover:bg-muted active:translate-y-px"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

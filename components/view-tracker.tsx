"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { visitorReady } from "@/lib/visitor-client";

/**
 * 조회수 표시 + 진입 시 1 증가. 서버가 돌려준 값으로 화면을 갱신하므로
 * 내 방문이 바로 숫자에 반영된다(예전에는 증가 전 값을 그려서 늘 1 이 모자랐다).
 * 중복 판정(같은 방문자 24시간)과 관리자·봇 제외는 서버가 한다. 실패하면 초기값 그대로 둔다.
 *
 * 방문자 쿠키가 확정된 뒤에 보낸다. 확정 전에 보내면 좋아요 요청과 서로 다른 토큰을
 * 발급받아 기록이 갈린다(V1). 초기화가 실패하면 이번 방문은 세지 않고 넘어간다.
 */
export function ViewTracker({
  kind,
  id,
  initial,
  className = "",
}: {
  kind: "notice" | "event" | "post";
  id: number;
  initial: number;
  className?: string;
}) {
  const { t } = useLanguage();
  const [count, setCount] = useState(initial);

  useEffect(() => {
    setCount(initial);
    let cancelled = false;
    visitorReady().then((ok) => {
      if (!ok || cancelled) return;
      fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && typeof d?.viewCount === "number") setCount(d.viewCount);
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [kind, id, initial]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="tabular-nums">{count}</span>
      <span className="sr-only">{t("common.views")}</span>
    </span>
  );
}

"use client";

import { useEffect } from "react";
import { visitorReady } from "@/lib/visitor-client";

/**
 * 상세 페이지 진입 시 조회수를 1 올린다. 결과는 쓰지 않는다 —
 * 실패해도 본문 열람에 영향이 없어야 하므로 오류를 삼킨다(중복 판정은 서버가 한다).
 *
 * 방문자 쿠키가 확정된 뒤에 보낸다. 확정 전에 보내면 좋아요 요청과 서로 다른 토큰을
 * 발급받아 기록이 갈린다(V1). 초기화가 실패하면 이번 방문은 세지 않고 넘어간다.
 */
export function ViewTracker({ kind, id }: { kind: "notice" | "event" | "post"; id: number }) {
  useEffect(() => {
    let cancelled = false;
    visitorReady().then((ok) => {
      if (!ok || cancelled) return;
      fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [kind, id]);
  return null;
}

"use client";

import { useEffect } from "react";

/**
 * 상세 페이지 진입 시 조회수를 1 올린다. 결과는 쓰지 않는다 —
 * 실패해도 본문 열람에 영향이 없어야 하므로 오류를 삼킨다(중복 판정은 서버가 한다).
 */
export function ViewTracker({ kind, id }: { kind: "notice" | "event" | "post"; id: number }) {
  useEffect(() => {
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    }).catch(() => {});
  }, [kind, id]);
  return null;
}

"use client";

import { Flag } from "lucide-react";

export function ReportButton({ targetType, targetId }: { targetType: "post" | "comment"; targetId: number }) {
  async function handleClick() {
    const reason = prompt("신고 사유를 입력하세요 (선택)");
    if (reason === null) return;
    const r = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason: reason.trim() || undefined }),
    });
    if (r.ok) {
      alert("신고가 접수되었습니다.");
    } else {
      const d = await r.json();
      alert(d.error ?? "신고 실패");
    }
  }

  return (
    <button onClick={handleClick} className="p-2 -m-2 text-muted-foreground hover:text-destructive" title="신고">
      <Flag className="h-3.5 w-3.5" />
    </button>
  );
}

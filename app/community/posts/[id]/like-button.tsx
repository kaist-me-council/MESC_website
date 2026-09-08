"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { visitorReady } from "@/lib/visitor-client";

/**
 * 좋아요. 토글이 아니라 "목표 상태" 를 보낸다(PUT { liked }).
 *
 * 서버가 저장했는데 응답만 유실되면 화면은 이전 상태로 되돌아간다. 그 상태에서 다시 누르면
 * 같은 목표 상태를 다시 보내게 되고, 서버는 이미 그 상태이므로 집계를 건드리지 않고
 * 현재 값을 돌려준다 — 재시도가 좋아요를 취소해 버리지 않는다.
 */
export function LikeButton({ postId, initialCount, initialLiked }: { postId: number; initialCount: number; initialLiked: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function apply(target: boolean) {
    if (busy) return;
    const prev = { liked, count };
    setBusy(true);
    setError("");
    setLiked(target);
    setCount(count + (target ? 1 : -1));
    try {
      if (!(await visitorReady())) throw new Error("잠시 후 다시 시도해주세요.");
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: target }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "잠시 후 다시 눌러주세요." : "처리하지 못했습니다.");
      const data = (await res.json()) as { liked: boolean; likeCount: number };
      setLiked(data.liked);
      setCount(data.likeCount);
    } catch (e) {
      // 화면을 이전 상태로 되돌린다. 다시 누르면 같은 목표 상태가 그대로 재시도된다.
      setLiked(prev.liked);
      setCount(prev.count);
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => apply(!liked)}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? "좋아요 취소" : "좋아요"}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors disabled:opacity-60 ${
          liked ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" : "border-border/60 hover:bg-muted"
        }`}
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
        <span className="tabular-nums">{count}</span>
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

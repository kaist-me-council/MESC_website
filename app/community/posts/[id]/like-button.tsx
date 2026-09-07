"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

/** 좋아요 토글. 낙관적으로 반영하고 실패하면 되돌린다. */
export function LikeButton({ postId, initialCount, initialLiked }: { postId: number; initialCount: number; initialLiked: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (busy) return;
    const prev = { liked, count };
    setBusy(true);
    setError("");
    setLiked(!liked);
    setCount(count + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      if (!res.ok) throw new Error(res.status === 429 ? "잠시 후 다시 눌러주세요." : "처리하지 못했습니다.");
      const data = (await res.json()) as { liked: boolean; likeCount: number };
      setLiked(data.liked);
      setCount(data.likeCount);
    } catch (e) {
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
        onClick={toggle}
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

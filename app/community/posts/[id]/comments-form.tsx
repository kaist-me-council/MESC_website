"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PostCommentForm({ postId }: { postId: number }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!content.trim()) return;
    setSubmitting(true); setError("");
    try {
      const r = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        setContent("");
        // 새로 작성된 댓글이 화면에 보이도록 reload (서버 컴포넌트라 router refresh)
        if (typeof window !== "undefined") window.location.reload();
      } else {
        setError(data.error ?? "댓글 작성 실패");
      }
    } catch {
      setError("댓글을 전송하지 못했습니다. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border/60 rounded-2xl">
      <CardContent className="p-4 space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="익명 댓글 작성 (1~1000자)"
          rows={3}
          maxLength={1000}
        />
        <Button onClick={submit} disabled={submitting || !content.trim()} size="sm" className="w-full">
          {submitting ? "전송 중..." : "댓글 달기"}
        </Button>
        {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}

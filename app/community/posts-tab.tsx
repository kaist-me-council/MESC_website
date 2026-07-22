"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageCircle, PenSquare } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface Post {
  id: number;
  category: string;
  title: string;
  content: string;
  authorTag: string;
  commentCount: number;
  createdAt: string;
}

const CATEGORIES = ["자유", "질문", "정보공유"] as const;
type Cat = typeof CATEGORIES[number];

export function PostsTab() {
  const { lang: language } = useLanguage();
  const locale = language === "ko" ? "ko-KR" : "en-US";
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Cat | "전체">("전체");
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Cat>("자유");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const url = filter === "전체" ? "/api/posts" : `/api/posts?category=${filter}`;
    const r = await fetch(url);
    if (r.ok) setPosts(await r.json());
  }
  useEffect(() => { load(); }, [filter]);

  async function submit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true); setError("");
    const r = await fetch("/api/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title: title.trim(), content: content.trim() }),
    });
    const data = await r.json();
    if (r.ok) {
      setTitle(""); setContent(""); setWriting(false);
      load();
    } else {
      setError(data.error ?? (language === "ko" ? "오류가 발생했습니다." : "An error occurred."));
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-3xl">
      {/* 안내 + 카테고리 필터 + 작성 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex gap-1 flex-wrap">
          {(["전체", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setWriting((v) => !v)} className="gap-2">
          <PenSquare className="h-4 w-4" />{writing ? "취소" : "글쓰기"}
        </Button>
      </div>

      {writing && (
        <Card className="mb-6 border-primary/30 rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === "ko" ? "제목 (2~100자)" : "Title (2-100 chars)"}
              maxLength={100}
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                language === "ko"
                  ? "내용 (5~5000자) — 익명으로 게시됩니다. 신상정보(학번/전화/이메일)는 입력하지 마세요."
                  : "Content (5-5000 chars) — posted anonymously. Do not include personal info (student ID/phone/email)."
              }
              rows={6}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">
              💡 1분에 3건까지 작성 가능. 신고 5건 누적 시 자동 숨김. 욕설·신상정보 포함 글은 거부됩니다.
            </p>
            <Button onClick={submit} disabled={submitting || !title.trim() || !content.trim()} className="w-full">
              {submitting ? "게시 중..." : "익명으로 게시"}
            </Button>
            {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      )}

      {/* 게시글 목록 */}
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">아직 작성된 게시글이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Link key={p.id} href={`/community/posts/${p.id}`}>
              <Card className="border-border/60 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{p.category}</Badge>
                    <span className="text-xs text-muted-foreground">{p.authorTag}</span>
                    <span className="text-xs text-muted-foreground">
                      · {new Date(p.createdAt).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className="font-semibold mb-1 truncate">{p.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.content}</p>
                  {p.commentCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {p.commentCount}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

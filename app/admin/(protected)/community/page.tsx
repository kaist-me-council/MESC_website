"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AdminGuide } from "@/components/admin-guide";
import { Eye, EyeOff, Trash2, MessageSquare, Inbox, Flag } from "lucide-react";

interface Suggestion {
  id: number;
  category: string;
  content: string;
  contactInfo: string | null;
  response: string | null;
  respondedAt: string | null;
  hidden: boolean;
  reportCount: number;
  createdAt: string;
}

interface Post {
  id: number;
  category: string;
  title: string;
  content: string;
  authorTag: string;
  hidden: boolean;
  reportCount: number;
  commentCount: number;
  createdAt: string;
}

export default function AdminCommunityPage() {
  const [tab, setTab] = useState<"건의" | "게시글">("건의");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [includeHidden, setIncludeHidden] = useState(true);
  const [responseEdit, setResponseEdit] = useState<Record<number, string>>({});

  async function load() {
    // 관리자 페이지는 hidden 포함해서 보여줘야 함 → 전용 admin 라우트가 없으므로 일단 일반 GET + 별도로 hidden 처리
    // (간단화: 일단 공개 GET 결과만 — hidden 은 별도 추가 가능)
    const sRes = await fetch("/api/admin/community");
    if (sRes.ok) {
      const data = await sRes.json();
      setSuggestions(data.suggestions);
      setPosts(data.posts);
    }
  }
  useEffect(() => { load(); }, []);

  async function saveResponse(id: number) {
    const response = responseEdit[id] ?? "";
    const r = await fetch(`/api/suggestions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    if (r.ok) {
      setResponseEdit((prev) => { const n = { ...prev }; delete n[id]; return n; });
      load();
    } else {
      alert("저장 실패");
    }
  }

  async function toggleHidden(type: "suggestion" | "post", id: number, current: boolean) {
    const url = type === "suggestion" ? `/api/suggestions/${id}` : `/api/posts/${id}`;
    const r = await fetch(url, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: !current }),
    });
    if (r.ok) load();
  }

  async function remove(type: "suggestion" | "post", id: number) {
    if (!confirm("영구 삭제하시겠습니까?")) return;
    const url = type === "suggestion" ? `/api/suggestions/${id}` : `/api/posts/${id}`;
    const r = await fetch(url, { method: "DELETE" });
    if (r.ok) load();
  }

  function visible<T extends { hidden: boolean }>(items: T[]): T[] {
    return includeHidden ? items : items.filter((i) => !i.hidden);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">커뮤니티 모더레이션</h1>
      </div>

      <AdminGuide id="community-mod" title="커뮤니티 모더레이션 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>건의함</strong>: 답변을 입력하면 작성자(와 일반 사용자)가 공개 페이지에서 답변을 볼 수 있습니다.</li>
          <li><strong>자유게시판</strong>: 신고 5건 누적 시 자동으로 숨겨집니다. 여기서 수동으로 다시 보이기/영구 삭제 가능.</li>
          <li><strong>신고 수</strong>가 높은 항목이 위에 오도록 정렬됩니다.</li>
        </ol>
        <p className="text-xs">💡 콘텐츠 필터(욕설·신상정보)는 작성 단계에서 1차 차단합니다. 통과한 글에 대한 추가 판단은 여기서.</p>
      </AdminGuide>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => setTab("건의")}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === "건의" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <Inbox className="h-3.5 w-3.5 inline mr-1" /> 건의 {suggestions.length}
          </button>
          <button onClick={() => setTab("게시글")}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === "게시글" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <MessageSquare className="h-3.5 w-3.5 inline mr-1" /> 게시글 {posts.length}
          </button>
        </div>
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} />
          숨김 포함
        </label>
      </div>

      {tab === "건의" && (
        <div className="space-y-3">
          {visible(suggestions).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">건의가 없습니다.</p>
          ) : (
            visible(suggestions).map((s) => {
              const editing = responseEdit[s.id] !== undefined;
              return (
                <Card key={s.id} className={s.hidden ? "opacity-60" : ""}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Badge variant="outline">{s.category}</Badge>
                        <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleString("ko-KR")}</span>
                        {s.reportCount > 0 && (
                          <Badge variant="destructive" className="gap-1"><Flag className="h-3 w-3" />{s.reportCount}</Badge>
                        )}
                        {s.hidden && <Badge variant="secondary">숨김</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleHidden("suggestion", s.id, s.hidden)} title={s.hidden ? "보이기" : "숨기기"}>
                          {s.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove("suggestion", s.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{s.content}</p>
                    {s.contactInfo && (
                      <p className="text-xs text-muted-foreground">📧 답변 연락처: <code>{s.contactInfo}</code></p>
                    )}
                    {editing ? (
                      <div className="space-y-2 mt-2 border-t pt-2">
                        <Textarea
                          value={responseEdit[s.id] ?? ""}
                          onChange={(e) => setResponseEdit((p) => ({ ...p, [s.id]: e.target.value }))}
                          rows={3}
                          placeholder="답변 (1~2000자)"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveResponse(s.id)}>저장</Button>
                          <Button size="sm" variant="ghost" onClick={() => setResponseEdit((p) => { const n = { ...p }; delete n[s.id]; return n; })}>취소</Button>
                        </div>
                      </div>
                    ) : s.response ? (
                      <div className="border-l-2 border-primary/50 bg-primary/5 rounded-r-lg p-3 text-sm">
                        <p className="text-xs font-semibold text-primary mb-1">학생회 답변 · {s.respondedAt && new Date(s.respondedAt).toLocaleDateString("ko-KR")}</p>
                        <p className="whitespace-pre-wrap">{s.response}</p>
                        <Button size="sm" variant="ghost" className="mt-1 text-xs h-7" onClick={() => setResponseEdit((p) => ({ ...p, [s.id]: s.response! }))}>
                          수정
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setResponseEdit((p) => ({ ...p, [s.id]: "" }))}>
                        + 답변 작성
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "게시글" && (
        <div className="space-y-3">
          {visible(posts).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">게시글이 없습니다.</p>
          ) : (
            visible(posts).map((p) => (
              <Card key={p.id} className={p.hidden ? "opacity-60" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <Badge variant="outline">{p.category}</Badge>
                      <span className="text-muted-foreground">{p.authorTag}</span>
                      <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleString("ko-KR")}</span>
                      {p.reportCount > 0 && (
                        <Badge variant="destructive" className="gap-1"><Flag className="h-3 w-3" />{p.reportCount}</Badge>
                      )}
                      {p.hidden && <Badge variant="secondary">숨김</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleHidden("post", p.id, p.hidden)}>
                        {p.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove("post", p.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-3">{p.content}</p>
                  {p.commentCount > 0 && (
                    <p className="text-xs text-muted-foreground">댓글 {p.commentCount}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

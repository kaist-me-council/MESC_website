"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminGuide } from "@/components/admin-guide";

interface Notice {
  id: number;
  title: string;
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  category: string;
  pinned: boolean;
  createdAt: string;
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [content, setContent] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [category, setCategory] = useState("공지");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function loadNotices() {
    const res = await fetch("/api/notices");
    const data = await res.json();
    setNotices(data);
  }

  useEffect(() => { loadNotices(); }, []);

  function resetForm() {
    setTitle(""); setTitleEn(""); setContent(""); setContentEn("");
    setCategory("공지"); setPinned(false); setEditingId(null);
  }

  function startEdit(notice: Notice) {
    setEditingId(notice.id);
    setTitle(notice.title);
    setTitleEn(notice.titleEn ?? "");
    setContent(notice.content);
    setContentEn(notice.contentEn ?? "");
    setCategory(notice.category);
    setPinned(notice.pinned);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);

    if (editingId !== null) {
      await fetch(`/api/notices/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, titleEn, content, contentEn, category, pinned }),
      });
    } else {
      await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, titleEn, content, contentEn, category, pinned }),
      });
    }

    resetForm();
    setSubmitting(false);
    loadNotices();
  }

  async function autoFillEn() {
    if (!title.trim() && !content.trim()) return;
    setTranslating(true);
    try {
      const tr = async (text: string) => {
        if (!text.trim()) return "";
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "번역 실패");
        return data.text as string;
      };
      setTitleEn(await tr(title));
      setContentEn(await tr(content));
    } catch (e) {
      alert(e instanceof Error ? e.message : "자동 번역에 실패했습니다.");
    } finally {
      setTranslating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/notices/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    loadNotices();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">공지사항 관리</h1>
      </div>

      <AdminGuide id="notices" title="공지사항 관리 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>새 공지 작성</strong>: 제목·내용을 입력하고 카테고리(공지/행사/학사)를 선택하세요.</li>
          <li><strong>영문(EN) 제목·내용은 선택</strong>: 입력하면 사이트 영어 모드에서 영문으로 표시되고, 비우면 한국어가 그대로 표시됩니다.</li>
          <li><strong>🌐 EN 자동 채우기</strong>: 한국어 제목·내용을 자동 번역해 EN 칸에 초안으로 채웁니다. <strong>결과를 꼭 검토·수정 후 등록</strong>하세요.</li>
          <li><strong>상단 고정</strong>을 체크하면 공개 페이지(/notices)에서 가장 위에 노출됩니다.</li>
          <li>등록 후에는 카드의 <strong>수정/삭제</strong> 버튼으로 관리합니다.</li>
        </ol>
        <p className="text-xs">💡 내용은 마크다운 형식이 아닌 일반 텍스트로 저장됩니다 — 줄바꿈은 그대로 반영됩니다.</p>
      </AdminGuide>

      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? (
                <span className="text-primary">✏️ 공지 수정 중</span>
              ) : "새 공지 작성"}
              {editingId !== null && (
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground">
                  취소
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>제목 (EN, 선택)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFillEn}
                  disabled={translating || (!title.trim() && !content.trim())}
                  className="h-7 text-xs"
                >
                  {translating ? "번역 중..." : "🌐 EN 자동 채우기"}
                </Button>
              </div>
              <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="영문 제목 — 비우면 영어 모드에서도 한국어 제목 표시" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="공지">공지</SelectItem>
                    <SelectItem value="행사">행사</SelectItem>
                    <SelectItem value="학사">학사</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>상단 고정</Label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="pinned"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="pinned" className="text-sm">고정 공지로 설정</label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="공지 내용을 입력하세요"
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>내용 (EN, 선택)</Label>
              <Textarea
                value={contentEn}
                onChange={(e) => setContentEn(e.target.value)}
                placeholder="영문 내용 — 비우면 영어 모드에서도 한국어 내용 표시"
                rows={6}
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting
                ? (editingId !== null ? "저장 중..." : "등록 중...")
                : (editingId !== null ? "수정 저장" : "공지 등록")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">등록된 공지 ({notices.length}건)</h2>
      <div className="space-y-2">
        {notices.map((notice) => (
          <Card key={notice.id} className={editingId === notice.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {notice.pinned && <Badge variant="destructive" className="text-xs">📌 고정</Badge>}
                  <Badge variant="secondary" className="text-xs">{notice.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notice.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <p className="font-medium truncate">{notice.title}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(notice)}
                  disabled={editingId === notice.id}
                >
                  수정
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(notice.id)}
                >
                  삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

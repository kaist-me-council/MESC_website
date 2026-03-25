"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Resource {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  category: string;
  courseCode: string | null;
  createdAt: string;
}

interface Course {
  id: number;
  code: string;
  name: string;
}

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [category, setCategory] = useState("200");
  const [courseCode, setCourseCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function loadResources() {
    const res = await fetch("/api/resources");
    const data = await res.json();
    setResources(data);
  }

  useEffect(() => {
    loadResources();
    fetch("/api/courses").then(r => r.json()).then(setCourses);
  }, []);

  function resetForm() {
    setTitle(""); setDescription(""); setFileUrl(""); setCategory("200"); setCourseCode(""); setEditingId(null);
  }

  function startEdit(r: Resource) {
    setEditingId(r.id);
    setTitle(r.title);
    setDescription(r.description ?? "");
    setFileUrl(r.fileUrl);
    setCategory(r.category);
    setCourseCode(r.courseCode ?? "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit() {
    if (!title.trim() || !fileUrl.trim()) return;
    setSubmitting(true);

    if (editingId !== null) {
      await fetch(`/api/resources/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, fileUrl, category, courseCode: courseCode || null }),
      });
    } else {
      await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, fileUrl, category, courseCode: courseCode || null }),
      });
    }

    resetForm();
    setSubmitting(false);
    loadResources();
  }

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/resources/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    loadResources();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">학습자료 관리</h1>
      </div>

      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? (
                <span className="text-primary">✏️ 자료 수정 중</span>
              ) : "새 자료 등록"}
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
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료 이름" />
            </div>
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="200">200번대</SelectItem>
                  <SelectItem value="300">300번대</SelectItem>
                  <SelectItem value="400">400번대</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>파일 URL (Google Drive, Dropbox 등 공유 링크)</Label>
              <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>연결 과목 (선택) — 수업 정보 페이지에서 표시됨</Label>
              <Select value={courseCode || "__none__"} onValueChange={(v) => setCourseCode(v != null && v !== "__none__" ? v : "")}>
                <SelectTrigger><SelectValue placeholder="과목 선택 안 함" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">과목 연결 안 함</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting
                ? (editingId !== null ? "저장 중..." : "등록 중...")
                : (editingId !== null ? "수정 저장" : "자료 등록")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">등록된 자료 ({resources.length}건)</h2>
      <div className="space-y-2">
        {resources.map((r) => (
          <Card key={r.id} className={editingId === r.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <p className="font-medium truncate">{r.title}</p>
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline truncate block">
                  {r.fileUrl}
                </a>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(r)}
                  disabled={editingId === r.id}
                >
                  수정
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>
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

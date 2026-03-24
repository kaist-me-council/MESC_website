"use client";

import { useEffect, useState } from "react";
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
  createdAt: string;
}

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [category, setCategory] = useState("200");
  const [submitting, setSubmitting] = useState(false);

  async function loadResources() {
    const res = await fetch("/api/resources");
    const data = await res.json();
    setResources(data);
  }

  useEffect(() => { loadResources(); }, []);

  async function handleSubmit() {
    if (!title.trim() || !fileUrl.trim()) return;
    setSubmitting(true);
    await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, fileUrl, category }),
    });
    setTitle(""); setDescription(""); setFileUrl("");
    setSubmitting(false);
    loadResources();
  }

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/resources/${id}`, { method: "DELETE" });
    loadResources();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">학습자료 관리</h1>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">새 자료 등록</CardTitle>
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
            <Label>설명 (선택)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "등록 중..." : "자료 등록"}
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-4">등록된 자료 ({resources.length}건)</h2>
      <div className="space-y-2">
        {resources.map((r) => (
          <Card key={r.id}>
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
              <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}>
                삭제
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

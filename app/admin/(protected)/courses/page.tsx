"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Youtube, BookMarked, BookOpen } from "lucide-react";

interface Course {
  id: number;
  code: string;
  name: string;
  level: string;
  description: string | null;
  textbook: string | null;
  textbookAvailable: boolean;
  youtubeUrl: string | null;
  order: number;
}

const LEVEL_LABELS: Record<string, string> = { "200": "200번대", "300": "300번대", "400": "400번대", "기타": "기타" };

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("200");
  const [description, setDescription] = useState("");
  const [textbook, setTextbook] = useState("");
  const [textbookAvailable, setTextbookAvailable] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [order, setOrder] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/courses");
    setCourses(await res.json());
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setCode(""); setName(""); setLevel("200"); setDescription("");
    setTextbook(""); setTextbookAvailable(false); setYoutubeUrl(""); setOrder("0");
    setEditingId(null); setSubmitError("");
  }

  function startEdit(c: Course) {
    setEditingId(c.id); setCode(c.code); setName(c.name); setLevel(c.level);
    setDescription(c.description ?? ""); setTextbook(c.textbook ?? "");
    setTextbookAvailable(c.textbookAvailable); setYoutubeUrl(c.youtubeUrl ?? "");
    setOrder(String(c.order)); setSubmitError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit() {
    if (!code.trim() || !name.trim()) return;
    setSubmitting(true); setSubmitError("");
    const payload = { code, name, level, description, textbook, textbookAvailable, youtubeUrl, order: Number(order) };
    try {
      const res = editingId !== null
        ? await fetch(`/api/courses/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "오류가 발생했습니다."); }
      else { reset(); load(); }
    } catch { setSubmitError("네트워크 오류가 발생했습니다."); }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE" });
    if (editingId === id) reset();
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">수업 정보 관리</h1>
      </div>

      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? <span className="text-primary">✏️ 과목 수정 중</span> : "새 과목 추가"}
              {editingId !== null && <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">취소</Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>과목코드</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ME201" />
              </div>
              <div className="space-y-2">
                <Label>레벨</Label>
                <Select value={level} onValueChange={(v) => v && setLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["200", "300", "400", "기타"].map((l) => (
                      <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>과목명</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="동역학" />
            </div>
            <div className="space-y-2">
              <Label>수업 설명 (선택)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="수업에 대한 간략한 설명" />
            </div>
            <div className="space-y-2">
              <Label>전공서 (선택)</Label>
              <Input value={textbook} onChange={(e) => setTextbook(e.target.value)} placeholder="Engineering Mechanics: Dynamics" />
            </div>
            <div className="flex items-center gap-3 py-1">
              <Checkbox
                id="textbookAvailable"
                checked={textbookAvailable}
                onCheckedChange={(v: boolean | "indeterminate") => setTextbookAvailable(v === true)}
              />
              <Label htmlFor="textbookAvailable" className="cursor-pointer">학생회 전공서 보유</Label>
            </div>
            <div className="space-y-2">
              <Label>강의 영상 URL (선택)</Label>
              <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/..." />
            </div>
            <div className="space-y-2">
              <Label>정렬 순서</Label>
              <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "저장 중..." : editingId !== null ? "수정 저장" : "과목 추가"}
            </Button>
            {submitError && <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">등록된 과목 ({courses.length}개)</h2>
      <div className="space-y-3">
        {courses.map((c) => (
          <Card key={c.id} className={editingId === c.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono text-xs">{c.code}</Badge>
                  <Badge className="text-xs">{LEVEL_LABELS[c.level] ?? c.level}</Badge>
                  {c.textbookAvailable && <Badge variant="secondary" className="text-xs gap-1"><BookOpen className="h-3 w-3" />보유</Badge>}
                  {c.youtubeUrl && <Badge variant="secondary" className="text-xs gap-1 text-red-500"><Youtube className="h-3 w-3" />영상</Badge>}
                  {c.textbook && <Badge variant="outline" className="text-xs gap-1"><BookMarked className="h-3 w-3" /></Badge>}
                </div>
                <p className="font-semibold">{c.name}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => startEdit(c)} disabled={editingId === c.id}>수정</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>삭제</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

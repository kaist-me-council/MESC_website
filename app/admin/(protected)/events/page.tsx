"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";

interface EventPhoto { id: number; imageUrl: string; caption: string | null; }
interface Event {
  id: number; title: string; date: string; description: string | null;
  coverImage: string | null; photos: EventPhoto[];
  _count: { feedbacks: number };
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/events");
    setEvents(await res.json());
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setTitle(""); setDate(""); setDescription(""); setCoverImage("");
    setEditingId(null); setSubmitError("");
  }

  function startEdit(e: Event) {
    setEditingId(e.id); setTitle(e.title);
    setDate(new Date(e.date).toISOString().slice(0, 10));
    setDescription(e.description ?? ""); setCoverImage(e.coverImage ?? "");
    setSubmitError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadCover(file: File) {
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) setCoverImage(data.url);
    else setSubmitError(data.error ?? "업로드 실패");
  }

  async function handleSubmit() {
    if (!title.trim() || !date) return;
    setSubmitting(true); setSubmitError("");
    const payload = { title, date, description, coverImage };
    try {
      const res = editingId !== null
        ? await fetch(`/api/events/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) setSubmitError(data.error ?? "오류가 발생했습니다.");
      else { reset(); load(); }
    } catch { setSubmitError("네트워크 오류가 발생했습니다."); }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (editingId === id) reset();
    if (selectedEvent?.id === id) setSelectedEvent(null);
    load();
  }

  async function uploadPhotos(files: FileList) {
    if (!selectedEvent) return;
    setPhotoUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData(); form.append("file", file);
      await fetch(`/api/events/${selectedEvent.id}/photos`, { method: "POST", body: form });
    }
    const updated = await fetch(`/api/events/${selectedEvent.id}`).then(r => r.json());
    setSelectedEvent(updated);
    load();
    setPhotoUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function deletePhoto(photoId: number) {
    if (!selectedEvent) return;
    await fetch(`/api/events/${selectedEvent.id}/photos`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    const updated = await fetch(`/api/events/${selectedEvent.id}`).then(r => r.json());
    setSelectedEvent(updated);
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">행사 관리</h1>
      </div>

      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? <span className="text-primary">✏️ 행사 수정 중</span> : "새 행사 추가"}
              {editingId !== null && <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">취소</Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>행사명</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2024 신입생 OT" />
            </div>
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="행사에 대한 간략한 설명" />
            </div>
            <div className="space-y-2">
              <Label>대표 사진</Label>
              <div className="flex gap-2">
                <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="URL 또는 파일 업로드" className="flex-1 text-xs" />
                <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
              </div>
              {coverImage && (
                <div className="relative h-24 w-40 rounded-xl overflow-hidden bg-muted">
                  <Image src={coverImage} alt="대표 사진" fill className="object-cover" />
                </div>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "저장 중..." : editingId !== null ? "수정 저장" : "행사 추가"}
            </Button>
            {submitError && <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      {/* 사진 업로드 패널 */}
      {selectedEvent && (
        <Card className="mb-8 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" />{selectedEvent.title} 사진 관리</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>닫기</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {selectedEvent.photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden group">
                  <Image src={p.imageUrl} alt="" fill className="object-cover" />
                  <button onClick={() => deletePhoto(p.id)}
                    className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {photoUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Upload className="h-6 w-6" /><span className="text-xs">업로드</span></>}
              </button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { const files = e.target.files; if (files?.length) uploadPhotos(files); }} />
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold mb-4">등록된 행사 ({events.length}개)</h2>
      <div className="space-y-3">
        {events.map((e) => (
          <Card key={e.id} className={editingId === e.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {e.coverImage || e.photos[0] ? (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                    <Image src={e.coverImage ?? e.photos[0].imageUrl} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Camera className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{e.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("ko-KR")}</span>
                    <Badge variant="outline" className="text-xs gap-1"><Camera className="h-3 w-3" />{e.photos.length}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(e)}>사진</Button>
                <Button variant="outline" size="sm" onClick={() => startEdit(e)} disabled={editingId === e.id}>수정</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(e.id)}>삭제</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

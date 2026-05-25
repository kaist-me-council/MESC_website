"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Camera, Download, FolderSync, Loader2, MessageSquare, RefreshCw, Star, Upload, X } from "lucide-react";
import Image from "next/image";
import JSZip from "jszip";

interface EventPhoto { id: number; imageUrl: string; caption: string | null; source?: string; driveFileId?: string | null; }
interface Feedback { id: number; content: string; rating: number; createdAt: string; }
interface Event {
  id: number; title: string; date: string; description: string | null;
  coverImage: string | null; photos: EventPhoto[];
  driveFolderId?: string | null; lastSyncedAt?: string | null;
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
  const [zipDownloading, setZipDownloading] = useState(false);
  const [feedbackEvent, setFeedbackEvent] = useState<Event | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveMessage, setDriveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resyncingId, setResyncingId] = useState<number | null>(null);
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
    if (feedbackEvent?.id === id) setFeedbackEvent(null);
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

  async function handleDownloadPhotos() {
    if (!selectedEvent || selectedEvent.photos.length === 0) return;
    setZipDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(selectedEvent.title) ?? zip;
      const results = await Promise.allSettled(
        selectedEvent.photos.map(async (photo, index) => {
          const res = await fetch(photo.imageUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const urlPath = new URL(photo.imageUrl).pathname;
          const ext = urlPath.match(/\.(jpe?g|png|webp|gif)$/i)?.[1] ?? "jpg";
          const blob = await res.blob();
          folder.file(`${String(index + 1).padStart(2, "0")}.${ext}`, blob);
        })
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeName = selectedEvent.title.replace(/[\\/:*?"<>|]/g, "_");
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url; a.download = `${safeName}-사진.zip`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (failed > 0) alert(`ZIP 생성 완료 (${failed}개 사진을 가져오지 못했습니다).`);
    } catch {
      alert("ZIP 다운로드 중 오류가 발생했습니다.");
    } finally {
      setZipDownloading(false);
    }
  }

  async function handleDriveSync() {
    if (!driveFolderUrl.trim()) return;
    setDriveSyncing(true); setDriveMessage(null);
    try {
      const res = await fetch("/api/events/sync-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl: driveFolderUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDriveMessage({ type: "error", text: data.error ?? "동기화에 실패했습니다." });
      } else {
        setDriveMessage({
          type: "success",
          text: `"${data.title}" 동기화 완료 — 사진 ${data.added}개 추가, ${data.skipped}개 스킵 (총 ${data.totalFiles}개)`,
        });
        setDriveFolderUrl("");
        load();
      }
    } catch {
      setDriveMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setDriveSyncing(false);
    }
  }

  async function handleResync(eventId: number) {
    setResyncingId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/resync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "재동기화에 실패했습니다.");
      } else {
        alert(`재동기화 완료 — ${data.added}개 추가, ${data.skipped}개 스킵`);
        if (selectedEvent?.id === eventId) {
          const updated = await fetch(`/api/events/${eventId}`).then(r => r.json());
          setSelectedEvent(updated);
        }
        load();
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setResyncingId(null);
    }
  }

  async function openFeedbacks(e: Event) {
    setFeedbackEvent(e);
    setSelectedEvent(null);
    const res = await fetch(`/api/events/${e.id}/feedback`);
    setFeedbacks(await res.json());
  }

  async function deleteFeedback(feedbackId: number) {
    if (!feedbackEvent) return;
    if (!confirm("피드백을 삭제하시겠습니까?")) return;
    await fetch(`/api/events/${feedbackEvent.id}/feedback`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId }),
    });
    setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">행사 관리</h1>
      </div>

      {/* Google Drive 폴더 일괄 등록 */}
      <Card className="mb-6 border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderSync className="h-4 w-4 text-blue-500" />
            Google Drive 폴더로 일괄 등록
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            폴더명은 <code className="px-1 py-0.5 rounded bg-muted">YYYY-MM-DD-행사명</code> 형식 (예: <code className="px-1 py-0.5 rounded bg-muted">2026-05-10-신입생 환영회</code>).
            <br />폴더 공유 설정을 <strong>&quot;링크가 있는 모든 사용자가 보기&quot;</strong>로 변경한 뒤 URL을 붙여넣어 주세요.
          </p>
          <div className="flex gap-2">
            <Input
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 text-xs"
              disabled={driveSyncing}
            />
            <Button onClick={handleDriveSync} disabled={driveSyncing || !driveFolderUrl.trim()} className="gap-2">
              {driveSyncing ? <><Loader2 className="h-4 w-4 animate-spin" />동기화 중...</> : <><FolderSync className="h-4 w-4" />동기화</>}
            </Button>
          </div>
          {driveMessage && (
            <Alert variant={driveMessage.type === "error" ? "destructive" : "default"}>
              <AlertDescription className="text-xs">{driveMessage.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
            <div className="flex flex-wrap justify-between items-center gap-2">
              {selectedEvent.driveFolderId ? (
                <Button variant="outline" size="sm" onClick={() => handleResync(selectedEvent.id)}
                  disabled={resyncingId === selectedEvent.id} className="gap-2">
                  {resyncingId === selectedEvent.id
                    ? <><Loader2 className="h-4 w-4 animate-spin" />재동기화 중...</>
                    : <><RefreshCw className="h-4 w-4" />Drive 재동기화</>}
                </Button>
              ) : <span />}
              {selectedEvent.photos.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDownloadPhotos}
                  disabled={zipDownloading || photoUploading} className="gap-2">
                  {zipDownloading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />ZIP 생성 중...</>
                    : <><Download className="h-4 w-4" />ZIP 다운로드</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 피드백 관리 패널 */}
      {feedbackEvent && (
        <Card className="mb-8 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                {feedbackEvent.title} 피드백 관리
                <Badge variant="outline" className="text-xs">{feedbacks.length}개</Badge>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setFeedbackEvent(null)}>닫기</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">등록된 피드백이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {feedbacks.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < f.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">
                          {new Date(f.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm">{f.content}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0 h-7 px-2"
                      onClick={() => deleteFeedback(f.id)}>
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("ko-KR")}</span>
                    <Badge variant="outline" className="text-xs gap-1"><Camera className="h-3 w-3" />{e.photos.length}</Badge>
                    <Badge variant="outline" className="text-xs gap-1"><MessageSquare className="h-3 w-3" />{e._count.feedbacks}</Badge>
                    {e.driveFolderId && (
                      <Badge variant="outline" className="text-xs gap-1 border-blue-500/40 text-blue-600 dark:text-blue-400">
                        <FolderSync className="h-3 w-3" />Drive
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(e)}>사진</Button>
                <Button variant="outline" size="sm" onClick={() => openFeedbacks(e)}>피드백</Button>
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

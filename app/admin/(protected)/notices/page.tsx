"use client";

import { upload } from "@vercel/blob/client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminGuide } from "@/components/admin-guide";
import { Paperclip } from "lucide-react";

interface Attachment { name: string; url: string; driveFileId?: string | null; size: number; mime: string }

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

interface Notice {
  id: number;
  title: string;
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  category: string;
  pinned: boolean;
  createdAt: string;
  attachments?: Attachment[];
}

const MAX_ATTACHMENT_MB = 30;
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [step, setStep] = useState("");
  // null = 확인 중, "drive" = 구글 드라이브, "blob" = 사이트 저장소
  const [store, setStore] = useState<"drive" | "blob" | null>(null);
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
    setCategory("공지"); setPinned(false); setAttachments([]); setUploadError(""); setEditingId(null);
  }

  function startEdit(notice: Notice) {
    setEditingId(notice.id);
    setTitle(notice.title);
    setTitleEn(notice.titleEn ?? "");
    setContent(notice.content);
    setContentEn(notice.contentEn ?? "");
    setCategory(notice.category);
    setPinned(notice.pinned);
    setAttachments(notice.attachments ?? []);
    setUploadError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);

    if (editingId !== null) {
      await fetch(`/api/notices/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, titleEn, content, contentEn, category, pinned, attachments }),
      });
    } else {
      await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, titleEn, content, contentEn, category, pinned, attachments }),
      });
    }

    resetForm();
    setSubmitting(false);
    loadNotices();
  }

  // 파일은 브라우저에서 저장소로 직접 올린다.
  // 서버 함수를 거치면 Vercel 의 4.5MB 본문 한도에 걸려 큰 파일이 아예 도달하지 못한다.
  // 1순위는 학생회 구글 드라이브, 실패하면 사이트 저장소(Blob)로 자동 전환한다.

  /** 재개 가능 세션 URI 로 PUT. 성공하면 Drive 파일 ID. CORS 로 막히면 throw → Blob 으로 넘어간다. */
  /** 시간 제한을 건 fetch — 어떤 단계도 무한정 "업로드 중" 으로 멈추지 않게 한다. */
  async function fetchWithTimeout(input: string, init: RequestInit, ms: number, label: string) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetch(input, { ...init, signal: ctl.signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error(`${label} 응답이 없습니다. 다시 시도해주세요.`);
      throw new Error(`${label} 중 연결에 실패했습니다.`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function uploadOne(file: File): Promise<Attachment> {
    // 브라우저 → 사이트 저장소 → (서버가) 구글 드라이브 순서.
    // 예전에는 브라우저에서 구글로 바로 PUT 했지만, 사전 요청이 브라우저에서 통과하지 못해
    // 매번 실패하고 대기만 길어졌다. 드라이브 이동은 서버가 하므로 이 단계는 이제 필요 없다.
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    setStep(`${file.name} 올리는 중...`);
    let blob: { url: string };
    try {
      blob = await upload(`notices/${crypto.randomUUID()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload-file/token",
        multipart: file.size > 8 * 1024 * 1024,
      });
    } catch (e) {
      throw new Error(e instanceof Error ? `업로드 실패: ${e.message}` : "업로드에 실패했습니다.");
    }

    setStep(`${file.name} 확인 중...`);
    const res = await fetchWithTimeout("/api/admin/upload-file/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: blob.url, name: file.name, size: file.size }),
    }, 30_000, "파일 확인");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");

    // ③ 서버가 드라이브로 옮긴다 (브라우저→구글 직접 업로드가 막히는 환경 대비).
    //    실패하면 사이트 저장소 첨부를 그대로 쓴다 — 파일을 잃지 않는 것이 우선.
    try {
      setStep(`${file.name} 드라이브로 옮기는 중...`);
      const mv = await fetchWithTimeout("/api/admin/upload-file/to-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, name: file.name, size: file.size }),
      }, 90_000, "드라이브 이동");
      const mvData = await mv.json().catch(() => ({}));
      if (mv.ok && mvData.moved && mvData.driveFileId) {
        setStore("drive");
        return { url: "", driveFileId: mvData.driveFileId, name: mvData.name, size: mvData.size, mime: mvData.mime } as Attachment;
      }
    } catch (e) {
      console.warn("[attach] 드라이브 이동 실패, 사이트 저장소 유지", e);
    }

    setStore("blob");
    return data as Attachment;
  }

  async function uploadFiles(files: FileList) {
    setUploading(true); setUploadError("");
    const added: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 10 - attachments.length)) {
      if (file.size === 0) { setUploadError(`${file.name}: 빈 파일은 첨부할 수 없습니다.`); break; }
      if (file.size > MAX_ATTACHMENT_BYTES) { setUploadError(`${file.name}: 파일 크기는 ${MAX_ATTACHMENT_MB}MB 이하여야 합니다.`); break; }
      try {
        // 어떤 단계가 응답하지 않아도 화면이 멈춘 채로 남지 않도록 전체 상한을 둔다.
        added.push(await Promise.race([
          uploadOne(file),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("시간이 초과됐습니다. 네트워크를 확인하고 다시 시도해주세요.")), 5 * 60_000)),
        ]));
      } catch (e) {
        setUploadError(`${file.name}: ${e instanceof Error ? e.message : "업로드에 실패했습니다."}`); break;
      }
    }
    setUploading(false);
    setStep("");
    if (added.length) setAttachments((prev) => [...prev, ...added]);
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
          <li><strong>첨부파일</strong>은 최대 10개, 각 30MB까지 올릴 수 있습니다. 공지를 삭제하면 첨부파일도 함께 삭제됩니다.</li>
          <li>첨부는 <strong>학생회 구글 드라이브</strong>에 저장됩니다. 드라이브 연결이 없거나 실패하면 사이트 저장소로 자동 전환되며, 어느 쪽이든 학생에게는 똑같이 바로 다운로드됩니다. 연결은 <a href="/admin/site" className="underline">사이트 설정</a>에서 확인하세요.</li>
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
            <div className="space-y-2">
              <Label>첨부파일 (최대 10개, 각 30MB — PDF·한글·오피스·이미지·ZIP)</Label>
              {attachments.length > 0 && (
                <ul className="space-y-1">
                  {attachments.map((a, i) => (
                    <li key={`${a.driveFileId ?? a.url}-${i}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{kb(a.size)}</span>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>제거</Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  multiple
                  aria-label="첨부파일 선택"
                  className="text-sm"
                  disabled={uploading || attachments.length >= 10}
                  onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }}
                />
                {uploading && <span className="text-xs text-muted-foreground">{step || "업로드 중..."}</span>}
                {!uploading && store && (
                  <span className="text-xs text-muted-foreground">
                    저장 위치: {store === "drive" ? "구글 드라이브 (학생회 계정)" : "사이트 저장소"}
                  </span>
                )}
              </div>
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            </div>
            <Button onClick={handleSubmit} disabled={submitting || uploading} className="w-full">
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
                {!!notice.attachments?.length && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" aria-hidden="true" />첨부 {notice.attachments.length}개
                  </p>
                )}
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

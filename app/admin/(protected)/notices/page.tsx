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
import { Paperclip } from "lucide-react";

interface Attachment { id?: number; name: string; url: string; driveFileId?: string | null; size: number; mime: string }

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
  const [notify, setNotify] = useState(false);   // 새 공지 등록 시 알림 발송 여부
  const [notifyBusy, setNotifyBusy] = useState<number | "test" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [step, setStep] = useState("");
  // null = 확인 중, "drive" = 구글 드라이브, "blob" = 사이트 저장소
  const [store, setStore] = useState<"drive" | "blob" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitMsg, setSubmitMsg] = useState<{ kind: "error" | "warn" | "ok"; text: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 폼 세션: 작성 폼을 바꿀 때마다 증가한다. 업로드 시작 시 값을 캡처해 두고,
  // 늦게 끝난 업로드가 다른 공지의 폼을 건드리지 못하게 막는다.
  const sessionRef = useRef(0);
  const submittingRef = useRef(false);   // 같은 이벤트 루프의 중복 제출 방지 (state 는 비동기라 늦다)
  const uploadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /** 폼을 바꾸거나 비울 때 호출 — 진행 중인 업로드를 끊고 세션을 넘긴다. */
  function newSession() {
    sessionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    uploadingRef.current = false;
    setUploading(false);
    setStep("");
    return sessionRef.current;
  }

  async function loadNotices() {
    const res = await fetch("/api/notices");
    if (!res.ok) throw new Error(`목록 조회 실패 (${res.status})`);
    setNotices(await res.json());
  }

  useEffect(() => { loadNotices().catch(() => setSubmitMsg({ kind: "warn", text: "공지 목록을 불러오지 못했습니다. 새로고침해주세요." })); }, []);

  function resetForm() {
    newSession();
    setTitle(""); setTitleEn(""); setContent(""); setContentEn("");
    setCategory("공지"); setPinned(false); setNotify(false); setAttachments([]); setUploadError(""); setEditingId(null);
  }

  function startEdit(notice: Notice) {
    newSession();
    setSubmitMsg(null);
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
    if (submittingRef.current) return; // state 보다 먼저 막는다 (더블클릭)
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitMsg(null);

    // 유지하는 첨부는 id 만 보낸다 — 서버가 저장 위치를 DB 에서 읽어 id 를 그대로 둔다.
    const payload = {
      title, titleEn, content, contentEn, category, pinned,
      attachments: attachments.map((a) => (a.id ? { id: a.id } : a)),
      ...(editingId === null && notify ? { notify: true } : {}),
    };
    const editing = editingId !== null;

    try {
      let res: Response;
      try {
        res = await fetch(editing ? `/api/notices/${editingId}` : "/api/notices", {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // 응답이 유실됐다 — 서버가 저장했을 수도 있다. 자동 재등록은 하지 않는다.
        setSubmitMsg({ kind: "warn", text: "응답을 받지 못했습니다. 저장됐는지 아래 목록을 확인한 뒤 다시 시도해주세요." });
        await loadNotices().catch(() => {});
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const reason = res.status === 401 ? "로그인이 풀렸습니다. 다시 로그인해주세요."
          : (data as { error?: string }).error ?? `저장에 실패했습니다. (${res.status})`;
        setSubmitMsg({ kind: "error", text: reason });
        return; // 입력·첨부를 그대로 둔다
      }

      // 저장 성공 — 여기서만 폼을 비운다.
      // 알림 발송 결과는 저장과 별개다. 발송이 실패해도 공지는 저장된 상태로 둔다.
      const saved = await res.json().catch(() => ({} as Record<string, unknown>));
      const notifiedInfo = (saved as { notified?: { status?: string; sent?: number; failed?: number; pruned?: number } }).notified;
      const wantedNotify = !editing && notify;
      resetForm();
      try {
        await loadNotices();
        const base = editing ? "수정했습니다." : "등록했습니다.";
        if (wantedNotify && notifiedInfo) {
          const d = describeSend(notifiedInfo);
          setSubmitMsg({ kind: d.kind, text: `${base} ${d.text}` });
        } else {
          setSubmitMsg({ kind: "ok", text: base });
        }
      } catch {
        setSubmitMsg({ kind: "warn", text: "저장은 완료됐지만 목록 갱신에 실패했습니다. 새로고침해주세요." });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // 파일은 브라우저 → 우리 서버 → 구글 드라이브 순서로 올라간다.
  // 브라우저에서 구글로 바로 보내는 경로는 사전 요청이 막히고, 서버 함수는 본문이 4.5MB 로
  // 제한되므로, 3MB 씩 잘라 서버가 드라이브 세션에 이어 붙인다.
  const CHUNK = 3 * 1024 * 1024; // 256KB 배수 — 구글 resumable 요구사항
  const FALLBACK_MAX = 4 * 1024 * 1024;

  /** 시간 제한을 건 fetch — 어떤 단계도 무한정 "업로드 중" 으로 멈추지 않게 한다. */
  async function fetchWithTimeout(input: string, init: RequestInit, ms: number, label: string, outer?: AbortSignal) {
    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    outer?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetch(input, { ...init, signal: ctl.signal });
    } catch (e) {
      if (outer?.aborted) throw new Error("작업이 취소됐습니다.");
      if (e instanceof DOMException && e.name === "AbortError") throw new Error(`${label} 응답이 없습니다. 다시 시도해주세요.`);
      throw new Error(`${label} 중 연결에 실패했습니다.`);
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    }
  }

  /** 드라이브로 청크 업로드. 드라이브가 연결돼 있지 않으면 null 을 돌려 폴백으로 넘긴다. */
  async function uploadToDrive(
    file: File,
    say: (s: string) => void,
    signal: AbortSignal,
  ): Promise<Attachment | null> {
    const begin = await fetchWithTimeout("/api/admin/upload-file/drive-begin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size }),
    }, 30_000, "업로드 준비", signal);
    const bd = await begin.json().catch(() => ({}));
    if (!begin.ok) {
      if (bd.code === "drive_not_connected") return null;
      throw new Error(bd.error ?? "업로드를 시작하지 못했습니다.");
    }

    let start = 0;
    let guard = 0;
    while (start < file.size) {
      if (guard++ > 1000) throw new Error("업로드가 끝나지 않았습니다. 다시 시도해주세요.");
      const end = Math.min(start + CHUNK, file.size);
      const res = await fetchWithTimeout("/api/admin/upload-file/drive-chunk", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-upload-id": bd.uploadId as string,
          "x-chunk-start": String(start),
          "x-total-size": String(file.size),
        },
        body: file.slice(start, end),
      }, 120_000, "업로드", signal);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "업로드에 실패했습니다.");
      if (d.done) {
        return { url: "", driveFileId: d.driveFileId, name: d.name, size: d.size, mime: d.mime };
      }
      // 구글이 알려 준 위치로 맞춘다 (우리 계산과 어긋나도 여기서 수렴)
      start = typeof d.received === "number" && d.received > start ? d.received : end;
      say(`${file.name} ${Math.round((start / file.size) * 100)}% 올리는 중...`);
    }
    throw new Error("업로드가 끝나지 않았습니다. 다시 시도해주세요.");
  }

  /** 드라이브 미연결 시의 대비책. 서버 함수를 통과하므로 4MB 까지만. */
  async function uploadToBlob(file: File, signal: AbortSignal): Promise<Attachment> {
    if (file.size > FALLBACK_MAX)
      throw new Error("구글 드라이브가 연결되어 있지 않아 4MB 이하만 올릴 수 있습니다. 사이트 설정에서 드라이브를 연결해주세요.");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetchWithTimeout("/api/admin/upload-file/blob", { method: "POST", body: fd }, 120_000, "업로드", signal);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "업로드에 실패했습니다.");
    return d as Attachment;
  }

  async function uploadOne(file: File, session: number, signal: AbortSignal): Promise<Attachment> {
    /** 이 업로드를 시작한 폼이 아직 화면에 있을 때만 상태를 바꾼다. */
    const alive = () => sessionRef.current === session && !signal.aborted;
    const say = (s: string) => { if (alive()) setStep(s); };

    say(`${file.name} 0% 올리는 중...`);
    const viaDrive = await uploadToDrive(file, say, signal);
    if (viaDrive) {
      if (alive()) setStore("drive");
      return viaDrive;
    }

    say(`${file.name} 올리는 중...`);
    const viaBlob = await uploadToBlob(file, signal);
    if (alive()) setStore("blob");
    return viaBlob;
  }

  /** 발송 결과를 사람이 읽을 수 있는 문장으로. 내부 오류 원문은 노출하지 않는다. */
  function describeSend(d: { status?: string; sent?: number; failed?: number; pruned?: number }): { kind: "ok" | "warn"; text: string } {
    switch (d.status) {
      case "sent":
        return { kind: "ok", text: `알림을 ${d.sent}명에게 보냈습니다.` };
      case "partial":
        return { kind: "warn", text: `알림을 ${d.sent}명에게 보냈고 ${d.failed}건은 실패했습니다. 만료된 구독 ${d.pruned ?? 0}건은 정리했습니다.` };
      case "no_subscribers":
        return { kind: "warn", text: "알림을 받도록 설정한 사람이 아직 없습니다. 공지 페이지에서 '알림 받기'를 켜야 받을 수 있습니다." };
      case "not_configured":
        return { kind: "warn", text: "알림 발송 설정이 되어 있지 않습니다. 관리자에게 문의하세요." };
      case "lookup_failed":
        return { kind: "warn", text: "구독자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." };
      default:
        return { kind: "warn", text: "알림 발송 결과를 확인하지 못했습니다." };
    }
  }

  /** 이미 등록된 공지를 구독자에게 알림으로 보낸다. */
  async function sendNotify(id: number) {
    setNotifyBusy(id);
    setSubmitMsg(null);
    try {
      const res = await fetch(`/api/notices/${id}/notify`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setSubmitMsg(describeSend(data));
    } catch {
      setSubmitMsg({ kind: "warn", text: "알림 발송 중 연결에 실패했습니다." });
    } finally {
      setNotifyBusy(null);
    }
  }

  /** 아무 공지도 보내지 않고 내 기기로만 시험 발송. */
  async function sendTest() {
    setNotifyBusy("test");
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/admin/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      const d = describeSend(data);
      setSubmitMsg({ kind: d.kind, text: `[시험 발송] ${d.text}` });
    } catch {
      setSubmitMsg({ kind: "warn", text: "시험 발송 중 연결에 실패했습니다." });
    } finally {
      setNotifyBusy(null);
    }
  }

  async function uploadFiles(files: FileList) {
    if (uploadingRef.current) return; // 같은 이벤트 루프의 중복 시작도 막는다
    uploadingRef.current = true;
    const session = sessionRef.current;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setUploading(true); setUploadError("");

    const added: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 10 - attachments.length)) {
      if (file.size === 0) { setUploadError(`${file.name}: 빈 파일은 첨부할 수 없습니다.`); break; }
      if (file.size > MAX_ATTACHMENT_BYTES) { setUploadError(`${file.name}: 파일 크기는 ${MAX_ATTACHMENT_MB}MB 이하여야 합니다.`); break; }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // 어떤 단계가 응답하지 않아도 화면이 멈춘 채로 남지 않도록 전체 상한을 둔다.
        // race 는 원래 작업을 멈추지 못하므로 상한에 걸리면 signal 로 실제로 끊는다.
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => { ctl.abort(); rej(new Error("시간이 초과됐습니다. 네트워크를 확인하고 다시 시도해주세요.")); }, 5 * 60_000);
        });
        added.push(await Promise.race([uploadOne(file, session, ctl.signal), timeout]));
      } catch (e) {
        console.error("[attach] 업로드 실패", file.name, e);
        // 폼이 이미 바뀌었으면 그 폼에 오류를 띄우지 않는다
        if (sessionRef.current === session) setUploadError(`${file.name}: ${e instanceof Error ? e.message : "업로드에 실패했습니다."}`);
        break;
      } finally {
        // 성공해도 타이머가 남아 5분 뒤 컨트롤러를 끊는 것을 막는다
        if (timer) clearTimeout(timer);
      }
    }

    // 늦게 끝난 작업이 새 폼의 상태·첨부를 건드리지 못하게 막는 지점
    uploadingRef.current = false; // 세션이 바뀌었더라도 가드는 반드시 푼다 (잠기면 이후 선택이 조용히 무시된다)
    if (sessionRef.current !== session) return;
    abortRef.current = null;
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
    setSubmitMsg(null);
    try {
      const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
      if (!res.ok) { setSubmitMsg({ kind: "error", text: `삭제에 실패했습니다. (${res.status})` }); return; }
    } catch {
      setSubmitMsg({ kind: "warn", text: "응답을 받지 못했습니다. 목록을 확인해주세요." });
    }
    if (editingId === id) resetForm();
    await loadNotices().catch(() => setSubmitMsg({ kind: "warn", text: "목록 갱신에 실패했습니다. 새로고침해주세요." }));
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
                <Button variant="ghost" size="sm" onClick={resetForm} disabled={submitting} className="text-muted-foreground">
                  {uploading ? "취소 (업로드 중단)" : "취소"}
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
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="notify"
                    checked={notify}
                    disabled={editingId !== null}
                    onChange={(e) => setNotify(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="notify" className="text-sm">
                    알림 보내기
                    <span className="ml-1 text-xs text-muted-foreground">
                      {editingId !== null ? "(수정 시에는 목록의 버튼으로)" : "(구독한 학생에게 푸시)"}
                    </span>
                  </label>
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
            {submitMsg && (
              <p role="status" className={`text-sm ${submitMsg.kind === "error" ? "text-destructive" : submitMsg.kind === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {submitMsg.text}
              </p>
            )}
            <Button onClick={handleSubmit} disabled={submitting || uploading} className="w-full">
              {submitting
                ? (editingId !== null ? "저장 중..." : "등록 중...")
                : (editingId !== null ? "수정 저장" : "공지 등록")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold mb-4">등록된 공지 ({notices.length}건)</h2>
        <Button variant="outline" size="sm" disabled={notifyBusy !== null} onClick={sendTest}>{notifyBusy === "test" ? "보내는 중..." : "알림 시험 발송"}</Button>
      </div>
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
                  variant="secondary"
                  size="sm"
                  disabled={notifyBusy !== null}
                  onClick={() => sendNotify(notice.id)}
                  title="이 공지를 구독자에게 알림으로 보냅니다"
                >
                  {notifyBusy === notice.id ? "보내는 중..." : "알림"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(notice)}
                  // 업로드·저장 중에는 폼을 바꾸지 못하게 한다 (파일이 다른 공지에 붙는 것을 막는다)
                  disabled={editingId === notice.id || uploading || submitting}
                >
                  수정
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(notice.id)}
                  disabled={uploading || submitting}
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

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminGuide } from "@/components/admin-guide";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ImageIcon, Upload, Search, X } from "lucide-react";

interface Course {
  id: number;
  code: string;
  name: string;
}

interface CoverCandidate {
  url: string;
  title: string;
  authors: string;
  year: string;
  source: "google" | "openlibrary";
}

interface Book {
  id: number;
  title: string;
  titleEn: string | null;
  author: string | null;
  publisher: string | null;
  coverImage: string | null;
  isbn: string | null;
  quantity: number;
  available: boolean;
  category: string | null;
  courseId: number | null;
  order: number;
  course: Course | null;
}

const NO_COURSE_VALUE = "__none__";

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [isbn, setIsbn] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [available, setAvailable] = useState(true);
  const [category, setCategory] = useState("");
  const [courseId, setCourseId] = useState(NO_COURSE_VALUE);
  const [order, setOrder] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [coverSearching, setCoverSearching] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<CoverCandidate[]>([]);
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const [coverSearchError, setCoverSearchError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [booksRes, coursesRes] = await Promise.all([fetch("/api/books"), fetch("/api/courses")]);
    setBooks(await booksRes.json());
    setCourses(await coursesRes.json());
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setTitle(""); setTitleEn(""); setAuthor(""); setPublisher(""); setCoverImage(""); setIsbn("");
    setQuantity("1"); setAvailable(true); setCategory(""); setCourseId(NO_COURSE_VALUE); setOrder("0");
    setEditingId(null); setSubmitError("");
    setCoverCandidates([]); setCoverSearchOpen(false); setCoverSearchError("");
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setTitle(book.title);
    setTitleEn(book.titleEn ?? "");
    setAuthor(book.author ?? "");
    setPublisher(book.publisher ?? "");
    setCoverImage(book.coverImage ?? "");
    setIsbn(book.isbn ?? "");
    setQuantity(String(book.quantity));
    setAvailable(book.available);
    setCategory(book.category ?? "");
    setCourseId(book.courseId ? String(book.courseId) : NO_COURSE_VALUE);
    setOrder(String(book.order));
    setSubmitError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setSubmitError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setSubmitError(data.error ?? "표지 업로드 중 오류가 발생했습니다.");
      else setCoverImage(data.url);
    } catch {
      setSubmitError("표지 업로드 중 네트워크 오류가 발생했습니다.");
    }
    setUploading(false);
  }

  async function handleCoverSearch() {
    if (!title.trim()) {
      setCoverSearchError("먼저 제목을 입력해주세요.");
      setCoverSearchOpen(true);
      setCoverCandidates([]);
      return;
    }
    setCoverSearching(true);
    setCoverSearchError("");
    setCoverSearchOpen(true);
    setCoverCandidates([]);
    try {
      const params = new URLSearchParams({ title: title.trim() });
      if (author.trim()) params.set("author", author.trim());
      const res = await fetch(`/api/books/cover-search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) setCoverSearchError(data.error ?? "표지 검색 중 오류가 발생했습니다.");
      else setCoverCandidates(data.candidates ?? []);
    } catch {
      setCoverSearchError("표지 검색 중 네트워크 오류가 발생했습니다.");
    }
    setCoverSearching(false);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true); setSubmitError("");
    const payload = {
      title,
      titleEn,
      author,
      publisher,
      coverImage,
      isbn,
      quantity: Number(quantity),
      available,
      category,
      courseId: courseId === NO_COURSE_VALUE ? null : Number(courseId),
      order: Number(order),
    };
    try {
      const res = editingId !== null
        ? await fetch(`/api/books/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) setSubmitError(data.error ?? "오류가 발생했습니다.");
      else { reset(); load(); }
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    if (editingId === id) reset();
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">전공서적 서재 관리</h1>
      </div>

      <AdminGuide id="books" title="전공서적 서재 관리 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li>학생회가 보유한 전공서 제목, 저자, 권수, 분류를 입력합니다.</li>
          <li>표지는 이미지 파일을 업로드하거나 이미 업로드된 URL을 직접 붙여넣을 수 있습니다.</li>
          <li>과목과 연결하면 공개 서재 카드에서 해당 과목 상세 페이지로 이동할 수 있습니다.</li>
          <li>영문 제목이 비어 있으면 영어 모드에서도 한글 제목이 표시됩니다.</li>
        </ol>
      </AdminGuide>

      <div ref={formRef}>
        <Card className="mb-8 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? <span className="text-primary">전공서 수정 중</span> : "새 전공서 추가"}
              {editingId !== null && <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">취소</Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5">
              <div className="space-y-3">
                <div className="aspect-[3/4] rounded-xl bg-muted overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
                  {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverImage} alt="표지 미리보기" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-linear-to-br from-primary/15 via-muted to-muted">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-xs font-medium">표지 없음</span>
                    </div>
                  )}
                </div>
                <Label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border/60 bg-background text-sm font-medium text-muted-foreground transition-[background-color,color,border-color] hover:bg-muted hover:text-foreground">
                  <Upload className="h-4 w-4" />
                  {uploading ? "업로드 중..." : "표지 업로드"}
                  <Input className="hidden" type="file" accept="image/*" disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
                </Label>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>제목</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="열역학" />
                  </div>
                  <div className="space-y-2">
                    <Label>영문 제목 (선택)</Label>
                    <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Thermodynamics" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>저자 (선택)</Label>
                    <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Yunus A. Cengel" />
                  </div>
                  <div className="space-y-2">
                    <Label>출판사 (선택)</Label>
                    <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="McGraw-Hill" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ISBN (선택)</Label>
                    <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>표지 URL (선택)</Label>
                    <div className="flex gap-2">
                      <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." className="flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCoverSearch}
                        disabled={coverSearching}
                        className="shrink-0 gap-1.5"
                      >
                        <Search className="h-4 w-4" />
                        {coverSearching ? "검색 중..." : "표지 검색"}
                      </Button>
                    </div>
                  </div>
                </div>

                {coverSearchOpen && (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">표지 검색 결과</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-muted-foreground"
                        onClick={() => { setCoverSearchOpen(false); setCoverCandidates([]); setCoverSearchError(""); }}
                      >
                        <X className="h-4 w-4" /> 닫기
                      </Button>
                    </div>
                    {coverSearching ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">표지를 검색하고 있습니다...</p>
                    ) : coverSearchError ? (
                      <Alert variant="destructive"><AlertDescription>{coverSearchError}</AlertDescription></Alert>
                    ) : coverCandidates.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">표지 후보를 찾지 못했습니다. 제목이나 저자를 조정해보세요.</p>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {coverCandidates.map((c, i) => {
                          const selected = coverImage === c.url;
                          return (
                            <button
                              key={`${c.url}-${i}`}
                              type="button"
                              onClick={() => setCoverImage(c.url)}
                              className="group w-[104px] shrink-0 text-left transition-transform hover:-translate-y-0.5"
                            >
                              <div className={`aspect-[3/4] overflow-hidden rounded-lg bg-muted ring-2 transition-colors ${selected ? "ring-primary" : "ring-black/10 dark:ring-white/10 group-hover:ring-primary/50"}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={c.url} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
                              </div>
                              <p className="mt-1 truncate text-xs font-medium" title={c.title}>{c.title || "제목 미상"}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {[c.year, c.source === "google" ? "Google" : "OpenLibrary"].filter(Boolean).join(" · ")}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>보유 권수</Label>
                    <Input type="number" min="1" max="999" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>분류</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="열유체" />
                  </div>
                  <div className="space-y-2">
                    <Label>정렬 순서</Label>
                    <Input type="number" min="-1000000" max="1000000" value={order} onChange={(e) => setOrder(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <div className="flex h-9 items-center gap-3">
                      <Checkbox
                        id="available"
                        checked={available}
                        onCheckedChange={(v: boolean | "indeterminate") => setAvailable(v === true)}
                      />
                      <Label htmlFor="available" className="cursor-pointer">빌림 가능</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>연결 과목 (선택)</Label>
                  <Select value={courseId} onValueChange={(v) => v && setCourseId(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_COURSE_VALUE}>연결 없음</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={String(course.id)}>
                          {course.code} · {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={submitting || uploading} className="w-full">
              {submitting ? "저장 중..." : editingId !== null ? "수정 저장" : "전공서 추가"}
            </Button>
            {submitError && <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">등록된 전공서 ({books.length}권)</h2>
      <div className="space-y-3">
        {books.map((book) => (
          <Card key={book.id} className={editingId === book.id ? "rounded-2xl ring-2 ring-primary" : "rounded-2xl"}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-20 w-[60px] shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-black/10 dark:ring-white/10">
                  {book.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/15 to-muted">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {book.category && <Badge variant="outline" className="text-xs">{book.category}</Badge>}
                    <Badge variant={book.available ? "secondary" : "outline"} className="text-xs">{book.available ? "빌림 가능" : "전시만"}</Badge>
                    <Badge variant="outline" className="text-xs tabular-nums">{book.quantity}권</Badge>
                    {book.course && <Badge className="text-xs font-mono">{book.course.code}</Badge>}
                  </div>
                  <p className="font-semibold truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[book.author, book.publisher].filter(Boolean).join(" · ") || "저자/출판사 미입력"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(book)} disabled={editingId === book.id}>수정</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(book.id)}>삭제</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

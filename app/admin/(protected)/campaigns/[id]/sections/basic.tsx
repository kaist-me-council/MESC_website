"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Campaign } from "../types";
import { Toggle, type SectionProps } from "./shared";

function readImages(c: Campaign): string[] {
  if (Array.isArray(c.images)) return c.images;
  try { const value = c.images ? JSON.parse(c.images) : null; if (Array.isArray(value) && value.length) return value; } catch { /* ignore malformed legacy data */ }
  return c.imageUrl ? [c.imageUrl] : [];
}

export function BasicSection({ c, set, setC }: SectionProps) {
  const images = useMemo(() => readImages(c), [c]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const setImages = (next: string[]) => setC((prev) => ({ ...prev, images: next, imageUrl: next[0] ?? null }));
  const move = (i: number, d: number) => { const next = [...images]; const j = i + d; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; setImages(next); };
  async function upload(files: FileList) {
    setUploading(true); setError(""); const added: string[] = [];
    for (const file of Array.from(files).slice(0, 8 - images.length)) {
      const body = new FormData(); body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body }); const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "업로드 실패"); break; } added.push(data.url);
    }
    if (added.length) setC((prev) => { const next = readImages(prev).concat(added).slice(0, 8); return { ...prev, images: next, imageUrl: next[0] ?? null }; });
    setUploading(false);
  }
  return <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-1"><Label>제목</Label><Input className="h-11 rounded-xl" value={c.title} onChange={(e) => set("title", e.target.value)} /></div>
    <div className="space-y-1"><Label>제목 (EN)</Label><Input className="h-11 rounded-xl" value={c.titleEn ?? ""} onChange={(e) => set("titleEn", e.target.value || null)} /></div>
    <div className="space-y-1"><Label>주소 (slug)</Label><Input className="h-11 rounded-xl" value={c.slug} onChange={(e) => set("slug", e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} /></div>
    <div className="space-y-1"><Label>종류</Label><select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={c.kind} onChange={(e) => set("kind", e.target.value as Campaign["kind"])}><option value="goods">굿즈</option><option value="signup">일반 신청</option></select></div>
    <div className="flex flex-wrap gap-5 sm:col-span-2"><Toggle checked={c.enabled} onChange={(v) => set("enabled", v)} label="공개" /><Toggle checked={c.allowQty} onChange={(v) => set("allowQty", v)} label="수량 선택" /><Toggle checked={c.requireStudentId} onChange={(v) => set("requireStudentId", v)} label="학번 필수" /></div>
    <div className="space-y-2 sm:col-span-2"><Label>이미지 (최대 8장, 첫 장이 대표)</Label>{images.length > 0 && <div className="flex flex-wrap gap-3">{images.map((url, i) => <div key={`${url}-${i}`} className="w-28"><div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-28 w-28 rounded-xl border object-contain" />{i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">대표</span>}</div><div className="flex justify-between"><button disabled={i === 0} onClick={() => move(i, -1)}><ChevronLeft className="h-4 w-4" /></button><button className="text-xs text-destructive" onClick={() => setImages(images.filter((_, j) => i !== j))}>삭제</button><button disabled={i === images.length - 1} onClick={() => move(i, 1)}><ChevronRight className="h-4 w-4" /></button></div></div>)}</div>}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading || images.length >= 8} onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />{uploading && <span className="text-xs text-muted-foreground">업로드 중...</span>}{error && <p className="text-xs text-destructive">{error}</p>}</div>
    <div className="space-y-1 sm:col-span-2"><Label>설명</Label><Textarea value={c.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></div>
    <div className="space-y-1 sm:col-span-2"><Label>설명 (EN)</Label><Textarea value={c.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value || null)} /></div>
  </div>;
}

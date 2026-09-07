"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type Campaign, type Option, toLocal, toIso } from "./types";

/** images 는 JSON 문자열 또는 배열로 온다. 없으면 대표 이미지 한 장. */
function readImages(c: Campaign): string[] {
  const raw = c.images;
  if (Array.isArray(raw)) return raw;
  try { const a = raw ? JSON.parse(raw) : null; if (Array.isArray(a) && a.length) return a; } catch { /* ignore */ }
  return c.imageUrl ? [c.imageUrl] : [];
}

const ADJ_KEYS = ["대학원생", "교수님", "졸업생", "기타"] as const;
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];

export function SettingsTab({ c, setC, onSaved }: { c: Campaign; setC: (update: (prev: Campaign) => Campaign) => void; onSaved: () => Promise<void> }) {
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const adj = useMemo<Record<string, number>>(() => { try { return c.priceAdjust ? JSON.parse(c.priceAdjust) : {}; } catch { return {}; } }, [c.priceAdjust]);
  // 항상 함수형 갱신 — 업로드·저장이 도는 동안 최신 입력을 덮어쓰지 않게
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const setOpt = (i: number, patch: Partial<Option>) => setC((prev) => ({ ...prev, options: prev.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const setAdj = (k: string, v: string) => {
    const next = { ...adj };
    if (v === "" || Number(v) === 0) delete next[k]; else next[k] = Number(v);
    set("priceAdjust", Object.keys(next).length ? JSON.stringify(next) : null);
  };

  function addBulk(text: string) {
    setC((prev) => {
      const start = prev.options.length;
      const added: Option[] = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => {
        const [group = "", name = "", price = "0", stock = ""] = l.split(",").map((s) => s.trim());
        return { group, name, nameEn: "", price: Number(price) || 0, stock: stock === "" ? null : Number(stock), order: start + i, enabled: true };
      }).filter((o) => o.name);
      return { ...prev, options: [...prev.options, ...added] };
    });
    setBulk("");
  }
  const tshirtPreset = () =>
    addBulk(["흰색", "검정"].flatMap((g) => SIZES.map((s) => `${g},${s},${["2XL", "3XL", "4XL"].includes(s) ? 9500 : 8000},`)).join("\n"));

  const images = useMemo<string[]>(() => readImages(c), [c]);
  const setImages = (next: string[]) => setC((prev) => ({ ...prev, images: next, imageUrl: next[0] ?? null }));
  const appendImages = (urls: string[]) => setC((prev) => {
    const cur = readImages(prev).concat(urls).slice(0, 8);
    return { ...prev, images: cur, imageUrl: cur[0] ?? null };
  });

  async function upload(files: FileList) {
    setUploading(true); setMsg("");
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, 8 - images.length)) {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(data.error ?? "업로드 실패"); break; }
      added.push(data.url);
    }
    setUploading(false);
    if (added.length) appendImages(added);
  }
  const moveImage = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= images.length) return;
    const next = [...images]; [next[i], next[j]] = [next[j], next[i]]; setImages(next);
  };

  async function save() {
    if (busy) return; // 중복 제출 방지
    const snapshot = c; // 저장 시점 값을 그대로 보낸다
    setBusy(true); setMsg("");
    const res = await fetch(`/api/admin/campaigns/${snapshot.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...snapshot, options: snapshot.options.map((o) => ({ ...o, group: o.group || null, nameEn: o.nameEn || null })) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "저장 실패"); return; }
    setMsg("저장됨"); await onSaved();
  }
  async function remove() {
    const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: "DELETE" });
    if (res.ok) location.href = "/admin/campaigns";
    else { setConfirmDel(false); setMsg((await res.json().catch(() => ({}))).error ?? "삭제 실패"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>제목</Label><Input value={c.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>제목 (EN)</Label><Input value={c.titleEn ?? ""} onChange={(e) => set("titleEn", e.target.value || null)} /></div>
          <div className="space-y-1"><Label>주소 (slug)</Label><Input value={c.slug} onChange={(e) => set("slug", e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} /></div>
          <div className="space-y-1">
            <Label>종류</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={c.kind} onChange={(e) => set("kind", e.target.value as Campaign["kind"])}>
              <option value="goods">굿즈 (색상·사이즈 상품형 화면)</option>
              <option value="signup">일반 신청 (목록형 화면)</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-sm sm:col-span-2">
            <label className="flex items-center gap-2"><Checkbox checked={c.enabled} onCheckedChange={(v) => set("enabled", v === true)} /> 공개</label>
            <label className="flex items-center gap-2"><Checkbox checked={c.allowQty} onCheckedChange={(v) => set("allowQty", v === true)} /> 수량 선택 허용</label>
            <label className="flex items-center gap-2"><Checkbox checked={c.requireStudentId} onCheckedChange={(v) => set("requireStudentId", v === true)} /> 학번 필수</label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>이미지 (최대 8장 — 첫 장이 대표. 시안·사이즈표 등. JPG/PNG/WebP 5MB 이하, 원본 크기 유지)</Label>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((u, i) => (
                  <div key={u} className="relative w-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-28 w-28 rounded-md object-contain border bg-muted/40" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">대표</span>}
                    <div className="mt-1 flex justify-between text-xs">
                      <button type="button" className="px-1 disabled:opacity-30" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label="앞으로"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" className="px-1 text-destructive" onClick={() => setImages(images.filter((_, j) => j !== i))}>삭제</button>
                      <button type="button" className="px-1 disabled:opacity-30" disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} aria-label="뒤로"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="text-sm" disabled={uploading || images.length >= 8} onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
              {uploading && <span className="text-xs text-muted-foreground">업로드 중...</span>}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label>설명</Label><Textarea rows={4} value={c.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>설명 (EN)</Label><Textarea rows={3} value={c.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value || null)} /></div>
          <div className="space-y-1"><Label>시작 (비우면 즉시)</Label><Input type="datetime-local" value={toLocal(c.opensAt)} onChange={(e) => set("opensAt", toIso(e.target.value))} /></div>
          <div className="space-y-1"><Label>마감 (비우면 무기한)</Label><Input type="datetime-local" value={toLocal(c.closesAt)} onChange={(e) => set("closesAt", toIso(e.target.value))} /></div>
          <div className="space-y-1"><Label>1인 최대 수량 (비우면 무제한)</Label><Input type="number" min={1} value={c.maxPerPerson ?? ""} onChange={(e) => set("maxPerPerson", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-1"><Label>표시 순서 (작을수록 목록 위, 같으면 최신순)</Label><Input type="number" value={c.order ?? 0} onChange={(e) => set("order", Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><Label>입금 계좌 (완료 화면에만 표시)</Label><Input value={c.bankInfo ?? ""} onChange={(e) => set("bankInfo", e.target.value || null)} placeholder="예: 카카오뱅크 3333-00-0000000 홍길동" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>완료 안내</Label><Textarea rows={2} value={c.afterNote ?? ""} onChange={(e) => set("afterNote", e.target.value || null)} placeholder="예: 입금자명은 본인 이름으로. 수령은 종강 직전 학생회실(N7)." /></div>
          <div className="space-y-1 sm:col-span-2"><Label>완료 안내 (EN)</Label><Textarea rows={2} value={c.afterNoteEn ?? ""} onChange={(e) => set("afterNoteEn", e.target.value || null)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">수령 확인 (배부 후 받았어요 / 못 받았어요 조사)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={c.confirmEnabled} onCheckedChange={(v) => set("confirmEnabled", v === true)} /> 수령 확인 받기 — 켜면 <code className="text-xs">/apply/{c.slug}/confirm</code> 이 열립니다</label>
          <div className="space-y-1"><Label>확인 마감 (비우면 무기한)</Label><Input type="datetime-local" value={toLocal(c.confirmDeadline)} onChange={(e) => set("confirmDeadline", toIso(e.target.value))} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>확인 페이지 안내</Label><Textarea rows={3} value={c.confirmNote ?? ""} onChange={(e) => set("confirmNote", e.target.value || null)} placeholder="예: 못 받은 항목은 재고가 있으면 학생회실(N7)에서 드리고, 없으면 환불 또는 교환해 드립니다." /></div>
          <div className="space-y-1 sm:col-span-2"><Label>확인 페이지 안내 (EN)</Label><Textarea rows={2} value={c.confirmNoteEn ?? ""} onChange={(e) => set("confirmNoteEn", e.target.value || null)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">구분별 가산 금액 (옵션 가격에 더함, 원)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ADJ_KEYS.map((k) => (
            <div key={k} className="space-y-1"><Label>{k}</Label><Input type="number" step={100} value={adj[k] ?? ""} onChange={(e) => setAdj(k, e.target.value)} placeholder="0" /></div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">옵션 ({c.options.length}) — 굿즈는 그룹=색상, 이름=사이즈</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_90px_80px_60px_50px_40px] gap-2 text-xs text-muted-foreground px-1">
            <span>그룹</span><span>이름</span><span>EN</span><span>가격</span><span>재고</span><span>순서</span><span>사용</span><span></span>
          </div>
          {c.options.map((o, i) => (
            <div key={o.id ?? `new-${i}`} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_90px_80px_60px_50px_40px] gap-2 items-center">
              <Input value={o.group} onChange={(e) => setOpt(i, { group: e.target.value })} placeholder="그룹" />
              <Input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} placeholder="이름" />
              <Input value={o.nameEn} onChange={(e) => setOpt(i, { nameEn: e.target.value })} placeholder="EN" />
              <Input type="number" value={o.price} onChange={(e) => setOpt(i, { price: Number(e.target.value) || 0 })} />
              <Input type="number" value={o.stock ?? ""} onChange={(e) => setOpt(i, { stock: e.target.value === "" ? null : Number(e.target.value) })} placeholder="∞" />
              <Input type="number" value={o.order} onChange={(e) => setOpt(i, { order: Number(e.target.value) || 0 })} />
              <Checkbox checked={o.enabled} onCheckedChange={(v) => setOpt(i, { enabled: v === true })} />
              <Button size="sm" variant="ghost" aria-label="옵션 삭제" onClick={() => setC((prev) => ({ ...prev, options: prev.options.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <Label>옵션 일괄 추가 — 한 줄에 <code>그룹,이름,가격,재고</code> (재고 비우면 무제한)</Label>
            <Textarea rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"흰색,XL,8000,10\n검정,L,8000,"} className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!bulk.trim()} onClick={() => addBulk(bulk)}>추가</Button>
              <Button size="sm" variant="outline" onClick={tshirtPreset}>반팔티 14옵션 채우기</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={save}>{busy ? "저장 중..." : "저장"}</Button>
        {confirmDel
          ? <><Button variant="destructive" size="sm" onClick={remove}>정말 삭제</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>아니오</Button></>
          : <Button variant="outline" size="sm" onClick={() => setConfirmDel(true)}>캠페인 삭제</Button>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}

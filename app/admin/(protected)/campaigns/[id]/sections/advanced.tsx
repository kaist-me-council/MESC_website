"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toIso, toLocal } from "../types";
import type { SectionProps } from "./shared";
import { Toggle } from "./shared";
const KEYS = ["대학원생", "교수님", "졸업생", "기타"];
export function AdvancedSection({ c, set }: SectionProps) {
  const [confirm, setConfirm] = useState(false); const [error, setError] = useState("");
  const adj = useMemo<Record<string, number>>(() => { try { return c.priceAdjust ? JSON.parse(c.priceAdjust) : {}; } catch { return {}; } }, [c.priceAdjust]);
  const setAdj = (key: string, value: string) => { const next = { ...adj }; if (!value || !Number(value)) delete next[key]; else next[key] = Number(value); set("priceAdjust", Object.keys(next).length ? JSON.stringify(next) : null); };
  const remove = async () => { const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: "DELETE" }); if (res.ok) location.href = "/admin/campaigns"; else { setError((await res.json().catch(() => ({}))).error ?? "삭제 실패"); setConfirm(false); } };
  return <div className="space-y-6">
    <div><h3 className="mb-3 text-sm font-medium">구분별 가산 금액</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{KEYS.map((k) => <div key={k} className="space-y-1"><Label>{k}</Label><Input className="h-11 rounded-xl" type="number" value={adj[k] ?? ""} onChange={(e) => setAdj(k, e.target.value)} /></div>)}</div></div>
    <div className="space-y-4"><Toggle checked={c.confirmEnabled} onChange={(v) => set("confirmEnabled", v)} label="수령 확인 받기" />{c.confirmEnabled && <div className="grid animate-in gap-4 fade-in slide-in-from-top-1 duration-150 sm:grid-cols-2"><div className="space-y-1"><Label>확인 마감</Label><Input className="h-11 rounded-xl" type="datetime-local" value={toLocal(c.confirmDeadline)} onChange={(e) => set("confirmDeadline", toIso(e.target.value))} /></div><div className="space-y-1 sm:col-span-2"><Label>확인 페이지 안내</Label><Textarea value={c.confirmNote ?? ""} onChange={(e) => set("confirmNote", e.target.value || null)} /></div><div className="space-y-1 sm:col-span-2"><Label>확인 페이지 안내 (EN)</Label><Textarea value={c.confirmNoteEn ?? ""} onChange={(e) => set("confirmNoteEn", e.target.value || null)} /></div></div>}</div>
    <div className="space-y-1"><Label>표시 순서</Label><Input className="h-11 max-w-xs rounded-xl" type="number" value={c.order ?? 0} onChange={(e) => set("order", Number(e.target.value) || 0)} /></div>
    <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4"><h3 className="font-semibold text-destructive">위험 구역</h3><p className="text-xs text-muted-foreground">삭제한 캠페인은 되돌릴 수 없습니다.</p>{confirm ? <div className="flex gap-2"><Button variant="destructive" size="sm" onClick={() => void remove()}>정말 삭제</Button><Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>아니오</Button></div> : <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>캠페인 삭제</Button>}{error && <p className="text-sm text-destructive">{error}</p>}</div>
  </div>;
}

"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Campaign } from "./types";
import { BasicSection } from "./sections/basic";
import { ScheduleSection } from "./sections/schedule";
import { PricingSection } from "./sections/pricing";
import { RefundsSection } from "./sections/refunds";
import { QuestionsSection } from "./sections/questions";
import { OptionsSection } from "./sections/options";
import { AdvancedSection } from "./sections/advanced";

const SECTIONS = [["basic", "기본"], ["schedule", "일정"], ["pricing", "참가비·정원"], ["refunds", "취소·환불"], ["questions", "문항"], ["options", "옵션"], ["advanced", "고급"]] as const;
type SectionId = typeof SECTIONS[number][0];
function errorSection(message: string): SectionId {
  if (/문항|질문|선택지|question|중복.*id/i.test(message)) return "questions";
  if (/옵션|재고|가격|option|stock/i.test(message)) return "options";
  if (/계좌|입금|수량|정원|payment|max/i.test(message)) return "pricing";
  if (/취소|환불|refund|cancel/i.test(message)) return "refunds";
  if (/일시|시작|마감|장소|date|open|close/i.test(message)) return "schedule";
  return "basic";
}
export function SettingsTab({ c, setC, onSaved, onDirtyChange }: { c: Campaign; setC: (update: (prev: Campaign) => Campaign) => void; onSaved: () => Promise<void>; onDirtyChange?: (dirty: boolean) => void }) {
  const [baseline, setBaseline] = useState(() => JSON.stringify(c));
  const [active, setActive] = useState<SectionId>("basic"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [errorAt, setErrorAt] = useState<SectionId | null>(null);
  const dirty = JSON.stringify(c) !== baseline;
  const set = <K extends keyof Campaign>(key: K, value: Campaign[K]) => setC((prev) => ({ ...prev, [key]: value }));
  const props = { c, set, setC };
  const questions = useMemo(() => { try { return Array.isArray(c.questions) ? c.questions : c.questions ? JSON.parse(c.questions) : []; } catch { return []; } }, [c.questions]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => { const fn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener("beforeunload", fn); return () => window.removeEventListener("beforeunload", fn); }, [dirty]);
  useEffect(() => {
    const guardLinks = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented) return;
      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.href === window.location.href) return;
      if (!window.confirm("저장하지 않은 변경이 있습니다. 이동하시겠습니까?")) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", guardLinks, true); return () => document.removeEventListener("click", guardLinks, true);
  }, [dirty]);
  useEffect(() => { const observer = new IntersectionObserver((entries) => { const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (visible) setActive(visible.target.id.replace("settings-", "") as SectionId); }, { rootMargin: "-25% 0px -60%", threshold: [0, .25, .5] }); SECTIONS.forEach(([id]) => { const el = document.getElementById(`settings-${id}`); if (el) observer.observe(el); }); return () => observer.disconnect(); }, []);
  const jump = (id: SectionId) => { setActive(id); document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  async function save() {
    if (busy || !dirty) return; const snapshot = c; setBusy(true); setMessage(""); setErrorAt(null);
    const res = await fetch(`/api/admin/campaigns/${snapshot.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, options: snapshot.options.map((o) => ({ ...o, group: o.group || null, nameEn: o.nameEn || null })) }) });
    const data = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { const text = data.error ?? "저장 실패"; const section = errorSection(text); setMessage(text); setErrorAt(section); jump(section); return; }
    setBaseline(JSON.stringify(snapshot)); onDirtyChange?.(false); setMessage("저장되었습니다."); window.setTimeout(() => setMessage(""), 1500); await onSaved();
  }
  const reset = () => { setC(() => JSON.parse(baseline) as Campaign); setMessage(""); setErrorAt(null); };
  const warnings = [c.enabled && !c.options.some((o) => o.enabled) ? "공개 중이지만 사용 가능한 옵션이 없습니다." : null, c.options.some((o) => o.price > 0) && !c.requiresPayment ? "가격이 있는 옵션이 있지만 유료 행사가 꺼져 있습니다." : null].filter(Boolean) as string[];
  const contents: Record<SectionId, ReactNode> = { basic: <BasicSection {...props} />, schedule: <ScheduleSection {...props} />, pricing: <PricingSection {...props} />, refunds: <RefundsSection {...props} />, questions: <QuestionsSection {...props} />, options: <OptionsSection {...props} />, advanced: <AdvancedSection {...props} /> };
  return <div className="space-y-5 pb-40">
    {!!warnings.length && <div className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{warnings.map((w) => <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{w}</p>)}</div>}
    <div className="sticky top-0 z-20 -mx-1 overflow-x-auto border-b bg-background/95 px-1 py-3 backdrop-blur"><div className="flex w-max gap-2">{SECTIONS.map(([id, label]) => <button key={id} onClick={() => jump(id)} className={`rounded-full px-4 py-2 text-sm transition-colors ${active === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{label}</button>)}</div></div>
    <div className="space-y-8">{SECTIONS.map(([id, title]) => <Card id={`settings-${id}`} key={id} className={`scroll-mt-20 rounded-2xl border-border/60 ${errorAt === id ? "border-destructive ring-1 ring-destructive/30" : ""}`}><CardHeader><CardTitle className="text-base font-semibold">{title}{id === "options" ? ` (${c.options.length})` : ""}</CardTitle></CardHeader><CardContent>{errorAt === id && message && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}{contents[id]}</CardContent></Card>)}</div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,.08)] backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}><div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1 text-xs text-muted-foreground"><p>{c.requiresPayment ? "계좌 보임 · 입금 체크 필수" : "무료(계좌 비공개)"}</p><p>{c.showRemaining !== false ? "남은 자리 보임" : "남은 자리 숨김"} · {questions.length ? `추가 문항 ${questions.length}개` : "추가 문항 없음"}</p></div>{message && !errorAt && <span className="text-sm text-primary">{message}</span>}<div className="flex gap-2"><Button variant="outline" disabled={!dirty || busy} onClick={reset}>되돌리기</Button><Button disabled={!dirty || busy} onClick={() => void save()}>{busy ? "저장 중..." : "저장"}</Button></div></div></div>
  </div>;
}

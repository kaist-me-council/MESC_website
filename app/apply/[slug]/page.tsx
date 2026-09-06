"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { CheckCircle2, AlertTriangle, Lock, Minus, Plus, Landmark, Copy, Check, Shirt, ClipboardCheck } from "lucide-react";
import { GoodsPicker } from "./goods-picker";
import { MyOrders } from "./my-orders";
import { AFFILIATIONS, copyText, fill, localeOf, type Affiliation, type Campaign, type Option, type Order } from "./types";

export default function ApplyCampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [affiliation, setAffiliation] = useState<Affiliation>("학부생");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(() => {
    fetch(`/api/campaigns/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCampaign(d?.campaign ?? null))
      .catch(() => setCampaign(null));
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const won = (n: number) => fill(t("apply.won"), n.toLocaleString());
  const optName = (o: Option) => (lang === "en" && o.nameEn ? o.nameEn : o.name);
  const adjust = campaign?.priceAdjust?.[affiliation] ?? 0;
  const unit = (o: Option) => o.price + adjust;
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);
  const total = campaign ? campaign.options.reduce((sum, o) => sum + (qty[o.id] ?? 0) * unit(o), 0) : 0;
  const hasAdjust = campaign ? Object.values(campaign.priceAdjust ?? {}).some((v) => v) : false;

  function setQ(o: Option, n: number) {
    const cap = o.remaining === null ? Infinity : o.remaining;
    const maxTotal = campaign?.maxPerPerson ?? Infinity;
    const others = totalQty - (qty[o.id] ?? 0);
    const v = Math.max(0, Math.min(n, cap, maxTotal - others, campaign?.allowQty ? Infinity : 1));
    setQty({ ...qty, [o.id]: v });
  }

  async function submit() {
    if (!campaign) return;
    const items = campaign.options.filter((o) => (qty[o.id] ?? 0) > 0).map((o) => ({ optionId: o.id, qty: qty[o.id] }));
    if (!items.length) { setError(t("apply.selectError")); return; }
    if (!name.trim() || !email.trim() || (campaign.requireStudentId && !studentId.trim())) { setError(t("apply.formError")); return; }
    setSubmitting(true); setError("");
    const res = await fetch(`/api/campaigns/${slug}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliation, name: name.trim(), studentId: studentId.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined, items }),
    });
    const d = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.status === 409 && d.optionId) {
      const o = campaign.options.find((x) => x.id === d.optionId);
      setError(fill(t("apply.stockError"), o ? optName(o) : "?"));
      load();
      return;
    }
    if (!res.ok) { setError(d.error ?? t("apply.genericError")); return; }
    setOrder(d.order);
    setQty({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (campaign === undefined) return <PageSkeleton />;
  if (campaign === null) return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <p className="text-muted-foreground mb-4">{t("apply.notFound")}</p>
      <Link href="/apply" className="text-primary underline text-sm">{t("apply.back")}</Link>
    </div>
  );

  const title = lang === "en" && campaign.titleEn ? campaign.titleEn : campaign.title;
  const description = lang === "en" && campaign.descriptionEn ? campaign.descriptionEn : campaign.description;
  const fmt = (iso: string) => new Date(iso).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" });
  const groups = [...new Set(campaign.options.map((o) => o.group ?? ""))];
  const goods = campaign.kind === "goods";
  const card = "rounded-2xl border-border/60 shadow-lg shadow-primary/5";
  const showSticky = !order && campaign.open && totalQty > 0;

  return (
    <div className={`container mx-auto px-4 py-8 max-w-lg ${showSticky ? "pb-28" : ""}`}>
      <Link href="/apply" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t("apply.back")}</Link>

      {goods && <Gallery images={campaign.images?.length ? campaign.images : campaign.imageUrl ? [campaign.imageUrl] : []} title={title} />}

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "60ms" }}>
        <h1 className="text-3xl font-bold mt-2 mb-2 [text-wrap:balance]">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline" className="text-xs">{t(`apply.kind_${campaign.kind}`)}</Badge>
          <Badge variant={campaign.open ? "default" : "outline"}>{campaign.open ? t("apply.open") : t("apply.closed")}</Badge>
          {campaign.confirmOpen && <Badge variant="secondary" className="text-xs">{t("apply.confirmOpenBadge")}</Badge>}
          {campaign.closesAt && <span className="text-xs text-muted-foreground">{t("apply.until")} {fmt(campaign.closesAt)}</span>}
        </div>
        {description && <p className="text-muted-foreground whitespace-pre-line mb-6 [text-wrap:pretty]">{description}</p>}
      </div>

      {campaign.confirmOpen && !order && (
        <Link href={`/apply/${slug}/confirm`} className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
          <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1">{t("apply.goConfirm")}</span>
          <span className="text-primary">→</span>
        </Link>
      )}

      {order && <DoneCard order={order} won={won} t={t} lang={lang} onReset={() => setOrder(null)} />}

      {!order && !campaign.open && (
        <Alert className="mb-6 rounded-2xl"><Lock className="h-4 w-4" /><AlertDescription>{t("apply.closedNote")}</AlertDescription></Alert>
      )}

      {!order && (
        <Card className={`mb-6 ${card} animate-in fade-in slide-in-from-bottom-2 duration-300`} style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle>{t("apply.options")}</CardTitle>
            {campaign.maxPerPerson && !goods && <CardDescription>{fill(t("apply.maxPerPerson"), campaign.maxPerPerson)}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {goods ? (
              <GoodsPicker campaign={campaign} qty={qty} setQty={setQty} unit={unit} optName={optName} won={won} t={t} />
            ) : (
              groups.map((g) => (
                <div key={g} className="space-y-1.5">
                  {g && <p className="text-sm font-semibold">{g}</p>}
                  {campaign.options.filter((o) => (o.group ?? "") === g).map((o) => {
                    const q = qty[o.id] ?? 0;
                    const out = o.remaining !== null && o.remaining <= 0;
                    return (
                      <div key={o.id} className={`flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5 text-sm transition-colors ${q ? "border-primary/50 bg-primary/5" : ""} ${out ? "opacity-50" : ""}`}>
                        <div className="min-w-0">
                          <span className="font-medium">{optName(o)}</span>
                          <span className="ml-2 text-muted-foreground tabular-nums">{unit(o) === 0 ? t("apply.free") : won(unit(o))}</span>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {out ? t("apply.soldOut") : o.remaining === null ? t("apply.unlimited") : fill(t("apply.remaining"), o.remaining)}
                          </div>
                        </div>
                        {campaign.allowQty ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button type="button" size="icon-lg" variant="outline" className="h-10 w-10 rounded-lg" disabled={!campaign.open || q === 0} onClick={() => setQ(o, q - 1)} aria-label="-"><Minus className="h-4 w-4" /></Button>
                            <span className="w-6 text-center tabular-nums font-medium">{q}</span>
                            <Button type="button" size="icon-lg" variant="outline" className="h-10 w-10 rounded-lg" disabled={!campaign.open || out} onClick={() => setQ(o, q + 1)} aria-label="+"><Plus className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <Button type="button" size="sm" className="h-10 w-10 rounded-lg" variant={q ? "default" : "outline"} disabled={!campaign.open || out} onClick={() => setQ(o, q ? 0 : 1)} aria-label={optName(o)}>{q ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            {hasAdjust && <p className="text-xs text-muted-foreground">{t("apply.priceAdjustNote")}</p>}
          </CardContent>
        </Card>
      )}

      {!order && (
        <Card id="applicant" className={`mb-6 scroll-mt-20 ${card} animate-in fade-in slide-in-from-bottom-2 duration-300`} style={{ animationDelay: "180ms" }}>
          <CardHeader><CardTitle>{t("apply.applicant")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("apply.affiliation")} htmlFor="aff">
              <select id="aff" className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={affiliation} disabled={!campaign.open} onChange={(e) => setAffiliation(e.target.value as Affiliation)}>
                {AFFILIATIONS.map((a) => <option key={a} value={a}>{t(`apply.aff_${a}`)}</option>)}
              </select>
            </Field>
            <Field label={t("apply.name")} htmlFor="name"><Input id="name" className="h-11 rounded-xl" value={name} disabled={!campaign.open} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label={campaign.requireStudentId ? t("apply.studentId") : t("apply.studentIdOptional")} htmlFor="sid"><Input id="sid" className="h-11 rounded-xl" inputMode="numeric" value={studentId} disabled={!campaign.open} onChange={(e) => setStudentId(e.target.value)} placeholder="20250001" /></Field>
            <Field label={t("apply.email")} htmlFor="email"><Input id="email" className="h-11 rounded-xl" type="email" value={email} disabled={!campaign.open} onChange={(e) => setEmail(e.target.value)} placeholder="id@kaist.ac.kr" autoComplete="email" /></Field>
            <Field label={t("apply.phoneOptional")} htmlFor="phone"><Input id="phone" className="h-11 rounded-xl" type="tel" value={phone} disabled={!campaign.open} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" autoComplete="tel" /></Field>
            <Field label={t("apply.note")} htmlFor="note"><Textarea id="note" className="rounded-xl" rows={2} value={note} disabled={!campaign.open} onChange={(e) => setNote(e.target.value)} /></Field>

            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium">{t("apply.total")}</span>
              <span className="text-lg font-bold tabular-nums">{won(total)}</span>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button onClick={submit} disabled={!campaign.open || submitting} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50">{submitting ? t("apply.submitting") : t("apply.submit")}</Button>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("apply.privacyNote")}</p>
          </CardContent>
        </Card>
      )}

      <MyOrders campaign={campaign} t={t} lang={lang} won={won} />

      {showSticky && (
        <div className="fixed inset-x-0 bottom-0 z-40 md:hidden animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-auto max-w-lg px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="glass-premium flex items-center gap-3 rounded-2xl border border-border/60 p-3 shadow-xl shadow-primary/10">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{t("apply.total")} · {totalQty}{t("apply.each")}</p>
                <p className="text-lg font-bold tabular-nums leading-tight">{won(total)}</p>
              </div>
              <Button className="h-11 rounded-xl px-5 font-semibold" onClick={() => document.getElementById("applicant")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{t("apply.stickyApply")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function CopyButton({ text, t }: { text: string; t: (k: string) => string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1500); } }}
      className="relative inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.96]">
      <span className="relative h-3.5 w-3.5">
        <Copy className={`absolute inset-0 h-3.5 w-3.5 transition-[opacity,scale,filter] duration-200 ${done ? "opacity-0 scale-[0.25] blur-[4px]" : "opacity-100 scale-100"}`} />
        <Check className={`absolute inset-0 h-3.5 w-3.5 text-primary transition-[opacity,scale,filter] duration-200 ${done ? "opacity-100 scale-100" : "opacity-0 scale-[0.25] blur-[4px]"}`} />
      </span>
      {done ? t("apply.copied") : t("apply.copy")}
    </button>
  );
}

function DoneCard({ order, won, t, lang, onReset }: { order: Order; won: (n: number) => string; t: (k: string) => string; lang: string; onReset: () => void }) {
  const after = lang === "en" && order.afterNoteEn ? order.afterNoteEn : order.afterNote;
  return (
    <Card className="mb-6 rounded-2xl border-primary/40 shadow-lg shadow-primary/10 animate-in fade-in zoom-in-95 duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />{t("apply.doneTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-primary/5 p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground">{t("apply.orderNo")}</p>
          <p className="text-3xl font-black tracking-[0.15em] tabular-nums">{order.orderNo}</p>
          <CopyButton text={order.orderNo} t={t} />
        </div>
        <ul className="text-sm space-y-1">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between"><span>{i.group ? `${i.group} · ` : ""}{i.name} × {i.qty}</span><span className="tabular-nums">{won(i.unitPrice * i.qty)}</span></li>
          ))}
          <li className="flex justify-between font-bold border-t border-border/60 pt-2 mt-1"><span>{t("apply.total")}</span><span className="tabular-nums">{won(order.total)}</span></li>
        </ul>
        {order.total > 0 && order.bankInfo && (
          <div className="rounded-xl border border-border/60 p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-medium flex items-center gap-1.5"><Landmark className="h-4 w-4" />{t("apply.bank")}</p>
              <CopyButton text={order.bankInfo} t={t} />
            </div>
            <p className="whitespace-pre-line select-all">{order.bankInfo}</p>
            <p className="text-xs text-muted-foreground">{t("apply.bankHint")}</p>
          </div>
        )}
        {after && <p className="text-sm whitespace-pre-line [text-wrap:pretty]">{after}</p>}
        <Alert className="rounded-xl"><AlertTriangle className="h-4 w-4" /><AlertDescription>{t("apply.screenshot")}</AlertDescription></Alert>
        <Button variant="outline" className="w-full h-11 rounded-xl" onClick={onReset}>{t("apply.newOrder")}</Button>
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-lg space-y-4 animate-pulse" aria-busy="true">
      <div className="h-4 w-16 rounded bg-muted" />
      <div className="aspect-[4/3] w-full rounded-2xl bg-muted" />
      <div className="h-8 w-2/3 rounded bg-muted" />
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-40 w-full rounded-2xl bg-muted" />
      <div className="h-64 w-full rounded-2xl bg-muted" />
    </div>
  );
}

/** 상품 이미지 갤러리 — 자르지 않고(object-contain) 보여 주고, 탭하면 원본을 새 탭에서 연다. */
function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div className="mt-3 mb-4 animate-in fade-in duration-300">
      <div className="w-full overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10 bg-muted/30">
        {cur ? (
          <a href={cur} target="_blank" rel="noopener noreferrer" aria-label="원본 크게 보기">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur} alt={`${title} ${i + 1}`} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
          </a>
        ) : (
          <div className="aspect-[4/3] grid place-items-center bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 tech-mesh">
            <Shirt className="h-16 w-16 text-primary/60" strokeWidth={1.25} />
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((u, k) => (
            <button key={u} type="button" onClick={() => setI(k)} aria-label={`${k + 1}번 이미지`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted/40 transition-all ${k === i ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
import { CheckCircle2, AlertTriangle, Lock, Minus, Plus, Landmark, Copy, Check, Shirt, ClipboardCheck, CalendarPlus, MapPin, Eye } from "lucide-react";
import { GoodsPicker } from "./goods-picker";
import { LinkifyText } from "@/components/linkify-text";
import { MyOrders } from "./my-orders";
import { AFFILIATIONS, copyText, errText, fill, localeOf, newIdemKey, request, type Affiliation, type Answer, type Campaign, type Option, type Order, type Question, type ReqFail, type T } from "./types";

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
  const [depositorName, setDepositorName] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [depositChecked, setDepositChecked] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelPasswordConfirm, setCancelPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [retryHint, setRetryHint] = useState(false); // 네트워크 실패 — 이미 접수됐을 수 있음
  const [order, setOrder] = useState<Order | null>(null);
  const [loadFail, setLoadFail] = useState<ReqFail | null>(null);
  // 한 번 작성한 폼에 대해 재전송해도 주문이 중복 생성되지 않도록 고정. 성공하면 새로 발급.
  const [idemKey, setIdemKey] = useState(newIdemKey);

  /** 고를 게 하나뿐이면 미리 담아 둔다 — "참가" 를 한 번 더 누르게 할 이유가 없다. */
  const defaultQty = (c: Campaign): Record<number, number> => {
    const only = c.options.length === 1 ? c.options[0] : null;
    return only && (c.open || c.preview) && !only.soldOut ? { [only.id]: 1 } : {};
  };

  const load = useCallback(async () => {
    const r = await request<{ campaign: Campaign }>(`/api/campaigns/${slug}`);
    if (r.ok) {
      const c = r.data.campaign ?? null;
      setCampaign(c);
      setLoadFail(null);
      // 아직 아무것도 고르지 않았을 때만 채운다 — 재고 충돌로 다시 불러올 때 고른 걸 날리지 않게
      if (c) setQty((prev) => (Object.keys(prev).length ? prev : defaultQty(c)));
    }
    else if (r.kind === "client") { setCampaign(null); setLoadFail(null); } // 404 = 없는 이벤트
    else { setCampaign(undefined); setLoadFail(r); }
  }, [slug]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

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
    const needsStudentId = campaign.requireStudentId && affiliation !== "교수님";
    if (!name.trim() || !email.trim() || (needsStudentId && !studentId.trim())) { setError(t(needsStudentId ? "apply.formError" : "apply.formErrorNoStudentId")); return; }
    if (campaign.requirePhone && !phone.trim()) { setError(t("apply.phoneRequired")); return; }
    if (cancelPassword.length < 6 || cancelPassword.length > 32) { setError(t("apply.cancelPasswordRequired")); return; }
    if (cancelPassword !== cancelPasswordConfirm) { setError(t("apply.cancelPasswordMismatch")); return; }
    if (campaign.requiresPayment && !depositChecked) { setError(t("apply.payRequired")); return; }
    setSubmitting(true); setError(""); setRetryHint(false);
    const r = await request<{ order: Order }>(`/api/campaigns/${slug}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliation, name: name.trim(), studentId: studentId.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined, depositorName: campaign.requiresPayment ? depositorName.trim() || undefined : undefined, note: note.trim() || undefined, answers, depositChecked, cancelPassword, items, idempotencyKey: idemKey }),
    });
    setSubmitting(false); // 실패해도 버튼을 다시 열어 재시도 가능하게. 입력값은 그대로 유지.
    if (!r.ok) {
      if (r.status === 409 && typeof r.body.optionId === "number") {
        const o = campaign.options.find((x) => x.id === r.body.optionId);
        setError(fill(t("apply.stockError"), o ? optName(o) : "?"));
        Promise.resolve().then(load);
        return;
      }
      setError(errText(r, t));
      if (r.kind === "network") setRetryHint(true); // 이미 접수됐을 수 있으니 조회 먼저
      return;
    }
    setOrder(r.data.order);
    setQty({});
    setAnswers({});
    setDepositChecked(false);
    setCancelPassword("");
    setCancelPasswordConfirm("");
    setIdemKey(newIdemKey());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loadFail) return (
    <div className="container mx-auto px-4 py-8 max-w-lg space-y-4">
      <Link href="/apply" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t("apply.back")}</Link>
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span className="flex-1">{errText(loadFail, t)}</span>
          <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => Promise.resolve().then(load)}>{t("apply.retry")}</Button>
        </AlertDescription>
      </Alert>
    </div>
  );
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
  // 신청형 + 고를 게 하나 + 1인 1개 = 사실상 "참가 신청". 수량 스테퍼도 "남은 수량" 도 오해를 부른다.
  const soloSignup = !goods && campaign.options.length === 1 && (campaign.maxPerPerson === 1 || !campaign.allowQty);
  const images = campaign.images?.length ? campaign.images : campaign.imageUrl ? [campaign.imageUrl] : [];
  const card = "rounded-2xl border-border/60 shadow-lg shadow-primary/5";
  const canApply = campaign.open || !!campaign.preview;
  const showSticky = !order && canApply && totalQty > 0;

  return (
    <div className={`container mx-auto px-4 py-8 max-w-lg ${showSticky ? "pb-28" : ""}`}>
      <Link href="/apply" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t("apply.back")}</Link>

      {campaign.preview && (
        <Alert className="mt-3 mb-1 rounded-2xl border-amber-500/40 bg-amber-500/10">
          <Eye className="h-4 w-4" />
          <AlertDescription>{t("apply.previewNote")}</AlertDescription>
        </Alert>
      )}

      {(goods || images.length > 0) && <Gallery images={images} title={title} t={t} />}

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "60ms" }}>
        <h1 className="text-3xl font-bold mt-2 mb-2 [text-wrap:balance]">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline" className="text-xs">{t(`apply.kind_${campaign.kind}`)}</Badge>
          <Badge variant={campaign.open ? "default" : "outline"}>{campaign.open ? t("apply.open") : t("apply.closed")}</Badge>
          {campaign.preview && <Badge variant="destructive" className="text-xs">{t("apply.previewBadge")}</Badge>}
          {campaign.confirmOpen && <Badge variant="secondary" className="text-xs">{t("apply.confirmOpenBadge")}</Badge>}
          {campaign.closesAt && <span className="text-xs text-muted-foreground">{t("apply.until")} {fmt(campaign.closesAt)}</span>}
        </div>
        {campaign.eventAt && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-sm">
            <CalendarPlus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="font-medium">{fmt(campaign.eventAt)}</span>
            {campaign.eventPlace && (
              <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{campaign.eventPlace}</span>
            )}
            <a href={`/api/campaigns/${slug}/event.ics`} className="ml-auto text-xs font-medium text-primary underline underline-offset-2">
              {t("apply.addToCalendar")}
            </a>
          </div>
        )}
        {description && <LinkifyText text={description} className="text-muted-foreground mb-6 [text-wrap:pretty]" />}
      </div>

      {campaign.confirmOpen && !order && (
        <Link href={`/apply/${slug}/confirm`} className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
          <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1">{t("apply.goConfirm")}</span>
          <span className="text-primary">→</span>
        </Link>
      )}

      {order && <DoneCard order={order} won={won} t={t} lang={lang} />}

      {!order && !campaign.open && !campaign.preview && (
        <Alert className="mb-6 rounded-2xl"><Lock className="h-4 w-4" /><AlertDescription>{t("apply.closedNote")}</AlertDescription></Alert>
      )}

      {!order && (
        <Card className={`mb-6 ${card} animate-in fade-in slide-in-from-bottom-2 duration-300`} style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle>{soloSignup ? t("apply.signupWhat") : t("apply.options")}</CardTitle>
            {soloSignup
              ? <CardDescription>{t("apply.signupSelf")}</CardDescription>
              : campaign.maxPerPerson && !goods && <CardDescription>{fill(t("apply.maxPerPerson"), campaign.maxPerPerson)}</CardDescription>}
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
                    const out = o.soldOut;
                    return (
                      <div key={o.id} className={`flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5 text-sm transition-colors ${q ? "border-primary/50 bg-primary/5" : ""} ${out ? "opacity-50" : ""}`}>
                        <div className="min-w-0">
                          <span className="font-medium">{optName(o)}</span>
                          <span className="ml-2 text-muted-foreground tabular-nums">{unit(o) === 0 ? t("apply.free") : won(unit(o))}</span>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {out ? t("apply.soldOut") : campaign.showRemaining && o.remaining !== null ? fill(t(goods ? "apply.remaining" : "apply.seatsLeft"), o.remaining) : ""}
                          </div>
                        </div>
                        {soloSignup ? (
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Check className="h-5 w-5" /></span>
                        ) : campaign.allowQty ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button type="button" size="icon-lg" variant="outline" className="h-10 w-10 rounded-lg" disabled={!canApply || q === 0} onClick={() => setQ(o, q - 1)} aria-label="-"><Minus className="h-4 w-4" /></Button>
                            <span className="w-6 text-center tabular-nums font-medium">{q}</span>
                            <Button type="button" size="icon-lg" variant="outline" className="h-10 w-10 rounded-lg" disabled={!canApply || out} onClick={() => setQ(o, q + 1)} aria-label="+"><Plus className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <Button type="button" size="sm" className="h-10 w-10 rounded-lg" variant={q ? "default" : "outline"} disabled={!canApply || out} onClick={() => setQ(o, q ? 0 : 1)} aria-label={optName(o)}>{q ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</Button>
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
              <select id="aff" className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={affiliation} disabled={!canApply} onChange={(e) => setAffiliation(e.target.value as Affiliation)}>
                {AFFILIATIONS.map((a) => <option key={a} value={a}>{t(`apply.aff_${a}`)}</option>)}
              </select>
            </Field>
            <Field label={t("apply.name")} htmlFor="name"><Input id="name" className="h-11 rounded-xl" value={name} disabled={!canApply} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label={campaign.requireStudentId && affiliation !== "교수님" ? t("apply.studentId") : t("apply.studentIdOptional")} htmlFor="sid"><Input id="sid" className="h-11 rounded-xl" inputMode="numeric" value={studentId} disabled={!canApply} onChange={(e) => setStudentId(e.target.value)} placeholder="20250001" /></Field>
            <Field label={t("apply.email")} htmlFor="email"><Input id="email" className="h-11 rounded-xl" type="email" value={email} disabled={!canApply} onChange={(e) => setEmail(e.target.value)} placeholder="id@kaist.ac.kr" autoComplete="email" /></Field>
            <Field label={campaign.requirePhone ? t("apply.phone") : t("apply.phoneOptional")} htmlFor="phone"><Input id="phone" className="h-11 rounded-xl" type="tel" value={phone} disabled={!canApply} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" autoComplete="tel" /></Field>
            {campaign.requiresPayment && <Field label={t("apply.depositorName")} htmlFor="depositor"><Input id="depositor" className="h-11 rounded-xl" value={depositorName} disabled={!canApply} onChange={(e) => setDepositorName(e.target.value)} placeholder={t("apply.depositorPlaceholder")} /></Field>}
            <Field label={t("apply.note")} htmlFor="note"><Textarea id="note" className="rounded-xl" rows={2} value={note} disabled={!canApply} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("apply.cancelPassword")} htmlFor="cancel-password"><Input id="cancel-password" className="h-11 rounded-xl" type="password" minLength={6} maxLength={32} autoComplete="new-password" value={cancelPassword} disabled={!canApply} onChange={(e) => setCancelPassword(e.target.value)} /></Field>
              <Field label={t("apply.cancelPasswordConfirm")} htmlFor="cancel-password-confirm"><Input id="cancel-password-confirm" className="h-11 rounded-xl" type="password" minLength={6} maxLength={32} autoComplete="new-password" value={cancelPasswordConfirm} disabled={!canApply} onChange={(e) => setCancelPasswordConfirm(e.target.value)} /></Field>
              <p className="text-xs text-muted-foreground sm:col-span-2 -mt-2">{t("apply.cancelPasswordHint")}</p>
            </div>

            {campaign.questions?.map((q) => (
              <QuestionField
                key={q.id} q={q} lang={lang} t={t} disabled={!canApply}
                value={answers[q.id]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              />
            ))}

            {campaign.requiresPayment && (
              <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
                <p className="text-sm font-medium">{t("apply.payNotice")}</p>
                {campaign.accountNumber && (
                  <div className="rounded-lg bg-background/70 p-2.5 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium inline-flex items-center gap-1.5"><Landmark className="h-4 w-4" aria-hidden="true" />{t("apply.bank")}</span>
                      <CopyButton text={campaign.accountNumber} t={t} />
                    </div>
                    {campaign.bankName && <p className="text-xs text-muted-foreground">{campaign.bankName}</p>}
                    <p className="font-semibold tabular-nums select-all">{campaign.accountNumber}</p>
                    <p className="text-xs text-muted-foreground">{t("apply.bankHint")}</p>
                    <p className="text-xs">{t("apply.depositorLabel")}: <strong>{depositorName.trim() || name.trim() || "—"}</strong></p>
                  </div>
                )}
                <label className="flex items-start gap-2.5 text-sm cursor-pointer has-[:disabled]:cursor-default">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={depositChecked} disabled={!canApply} onChange={(e) => setDepositChecked(e.target.checked)} />
                  <span>{t("apply.payCheck")}<span className="text-destructive"> *</span></span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium">{t("apply.total")}</span>
              <span className="text-lg font-bold tabular-nums">{won(total)}</span>
            </div>
            <div className="space-y-1.5 rounded-xl border border-border/60 p-3 text-xs text-muted-foreground [text-wrap:pretty]">
              <p className="font-semibold text-foreground">{t("apply.cancellationPolicyTitle")}</p>
              <p>{t("apply.cancellationPolicyAuto")}</p>
              <p>{t("apply.cancellationPolicyAfterPaid")}</p>
              <p><Link href="/terms#cancellation-refunds" className="text-primary underline underline-offset-2">{t("apply.cancellationPolicyTerms")}</Link></p>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {retryHint && (
              <Alert className="rounded-xl"><AlertTriangle className="h-4 w-4" /><AlertDescription>{t("apply.submitNetworkHint")}</AlertDescription></Alert>
            )}
            <Button onClick={submit} disabled={!canApply || submitting || (!!campaign.requiresPayment && !depositChecked)} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50">{submitting ? t("apply.submitting") : campaign.preview ? t("apply.previewSubmit") : t("apply.submit")}</Button>
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


/**
 * 추가 문항 한 칸. 필수 여부·형식 검증은 서버가 다시 한다 (화면만 믿지 않는다).
 * 값 모양: text/radio = string, checkbox = string[], consent = boolean.
 */
function QuestionField({ q, value, onChange, disabled, lang, t }: {
  q: Question; value: Answer | undefined; onChange: (v: Answer) => void; disabled: boolean; lang: string; t: T;
}) {
  const label = lang === "en" && q.labelEn ? q.labelEn : q.label;
  const req = q.required ? <span className="text-destructive"> *</span> : null;

  if (q.type === "consent") {
    return (
      <label className="flex items-start gap-2.5 rounded-xl border border-border/60 p-3 text-sm cursor-pointer has-[:disabled]:cursor-default">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="[text-wrap:pretty] whitespace-pre-line">{label}{req}</span>
      </label>
    );
  }
  if (q.type === "text") {
    return (
      <Field label={<>{label}{req}</>} htmlFor={`q-${q.id}`}>
        <Input id={`q-${q.id}`} className="h-11 rounded-xl" value={typeof value === "string" ? value : ""} disabled={disabled} maxLength={500} onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  const picked = Array.isArray(value) ? value : [];
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium mb-2 [text-wrap:pretty] whitespace-pre-line">{label}{req}</legend>
      <div className="space-y-1.5">
        {q.options?.map((o) => (
          <label key={o} className="flex items-center gap-2.5 rounded-xl border border-border/60 px-3 py-2.5 text-sm cursor-pointer has-[:disabled]:cursor-default has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
            <input
              type={q.type === "radio" ? "radio" : "checkbox"}
              name={`q-${q.id}`}
              className="h-4 w-4 shrink-0 accent-primary"
              checked={q.type === "radio" ? value === o : picked.includes(o)}
              onChange={() => onChange(q.type === "radio" ? o : picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o])}
            />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {q.type === "checkbox" && <p className="text-xs text-muted-foreground">{t("apply.checkboxHint")}</p>}
    </fieldset>
  );
}

function Field({ label, htmlFor, children }: { label: React.ReactNode; htmlFor: string; children: React.ReactNode }) {
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

function DoneCard({ order, won, t, lang }: { order: Order; won: (n: number) => string; t: (k: string) => string; lang: string }) {
  const bankName = order.campaign?.bankName;
  const accountNumber = order.campaign?.accountNumber;
  const after = lang === "en" && order.campaign?.afterNoteEn ? order.campaign.afterNoteEn : order.campaign?.afterNote;
  const needsPay = order.status === "pending" && order.total > 0;
  return (
    <Card className="mb-6 rounded-2xl border-primary/40 shadow-lg shadow-primary/10 animate-in fade-in zoom-in-95 duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><CheckCircle2 className="h-6 w-6 text-primary shrink-0" />{t("apply.doneTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 입금이 남았으면 그게 제일 중요하다 — 계좌와 안내를 맨 위에 크게 둔다 */}
        {needsPay && (
          <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4 space-y-2">
            <p className="text-base font-bold [text-wrap:pretty]">{t("apply.payPending")}</p>
            {accountNumber && (
              <div className="rounded-lg bg-background/80 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium inline-flex items-center gap-1.5"><Landmark className="h-4 w-4" aria-hidden="true" />{t("apply.bank")}</span>
                  <CopyButton text={accountNumber} t={t} />
                </div>
                {bankName && <p className="text-sm text-muted-foreground">{bankName}</p>}
                <p className="text-lg font-bold tabular-nums select-all [overflow-wrap:anywhere]">{accountNumber}</p>
                <p className="flex justify-between text-sm"><span className="text-muted-foreground">{t("apply.total")}</span><strong className="tabular-nums">{won(order.total)}</strong></p>
                <p className="text-sm">{t("apply.depositorLabel")}: <strong>{order.depositorName || order.name}</strong></p>
                <p className="text-xs text-muted-foreground">{t("apply.bankHint")}</p>
                <p className="text-xs text-muted-foreground [text-wrap:pretty]">{t("apply.paymentReviewDelay")}</p>
              </div>
            )}
          </div>
        )}

        <ul className="text-sm space-y-1">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between"><span>{i.group ? `${i.group} · ` : ""}{i.name} × {i.qty}</span><span className="tabular-nums">{won(i.unitPrice * i.qty)}</span></li>
          ))}
          {!needsPay && (
            <li className="flex justify-between font-bold border-t border-border/60 pt-2 mt-1"><span>{t("apply.total")}</span><span className="tabular-nums">{won(order.total)}</span></li>
          )}
        </ul>

        {!needsPay && after && <LinkifyText text={after} className="text-sm [text-wrap:pretty]" />}

        {/* 신청번호·관리 코드는 나중에 조회·취소할 때만 쓴다 — 작게, 설명과 함께 */}
        <div className="rounded-xl border border-border/60 divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("apply.orderNo")}</p>
              <p className="font-mono font-semibold tracking-wide [overflow-wrap:anywhere]">{order.orderNo}</p>
            </div>
            <CopyButton text={order.orderNo} t={t} />
          </div>
          {order.hasCancelPassword ? (
            <p className="p-3 text-xs text-muted-foreground [text-wrap:pretty]">{t("apply.cancelPasswordSaved")}</p>
          ) : order.manageCode ? (
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("apply.manageCode")}</p>
                  <p className="font-mono font-semibold tracking-wide [overflow-wrap:anywhere]">{order.manageCode}</p>
                </div>
                <CopyButton text={order.manageCode} t={t} />
              </div>
              <p className="text-xs text-muted-foreground [text-wrap:pretty]">{t("apply.manageCodeHint")}</p>
            </div>
          ) : (
            <p className="p-3 text-xs text-muted-foreground">{t("apply.alreadyReceived")}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("apply.screenshot")}</p>
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
function Gallery({ images, title, t }: { images: string[]; title: string; t: T }) {
  const [i, setI] = useState(0);
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div className="mt-3 mb-4 animate-in fade-in duration-300">
      <div className="w-full overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10 bg-muted/30">
        {cur ? (
          <a href={cur} target="_blank" rel="noopener noreferrer" aria-label={t("apply.imageOriginal")}>
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
            <button key={u} type="button" onClick={() => setI(k)} aria-label={fill(t("apply.imageNth"), k + 1)}
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

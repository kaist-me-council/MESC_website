"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { CheckCircle2, PackageX, Lock, AlertTriangle, ClipboardCheck } from "lucide-react";
import { LookupForm } from "../my-orders";
import { LinkifyText } from "@/components/linkify-text";
import { errText, fill, localeOf, request, type Campaign, type Choice, type Cred, type Order, type ReqFail, type Resolution, type T } from "../types";

/** 수령 확인: 주문 조회 → 받았어요/못 받았어요 → 못 받은 항목별 처리 선택 */
export default function ConfirmPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [cred, setCred] = useState<Cred | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadFail, setLoadFail] = useState<ReqFail | null>(null);
  const [lookupFail, setLookupFail] = useState<ReqFail | null>(null);

  const load = useCallback(async () => {
    const r = await request<{ campaign: Campaign }>(`/api/campaigns/${slug}`);
    if (r.ok) { setCampaign(r.data.campaign ?? null); setLoadFail(null); }
    else if (r.kind === "client") { setCampaign(null); setLoadFail(null); }
    else { setCampaign(undefined); setLoadFail(r); }
  }, [slug]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  async function lookup(c: Cred) {
    setLoading(true); setOrders(null); setNotFound(false); setLookupFail(null); setCred(c);
    const r = await request<{ orders: Order[] }>(`/api/campaigns/${slug}/lookup`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c),
    });
    setLoading(false);
    if (!r.ok) { setLookupFail(r); return; } // 통신 실패는 "주문 없음"과 구분
    const list: Order[] = (r.data.orders ?? []).filter((o) => o.status !== "cancelled");
    if (!list.length) { setNotFound(true); return; }
    setOrders(list);
  }

  if (loadFail) return (
    <div className="container mx-auto px-4 py-8 max-w-lg space-y-4">
      <Link href={`/apply/${slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t("confirm.backToCampaign")}</Link>
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span className="flex-1">{errText(loadFail, t)}</span>
          <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => Promise.resolve().then(load)}>{t("apply.retry")}</Button>
        </AlertDescription>
      </Alert>
    </div>
  );
  if (campaign === undefined) return <div className="container mx-auto px-4 py-8 max-w-lg space-y-3 animate-pulse"><div className="h-8 w-2/3 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" /><div className="h-64 rounded-2xl bg-muted" /></div>;
  if (campaign === null) return <div className="container mx-auto px-4 py-8 max-w-lg"><p className="text-muted-foreground">{t("apply.notFound")}</p></div>;

  const title = lang === "en" && campaign.titleEn ? campaign.titleEn : campaign.title;
  const note = lang === "en" && campaign.confirmNoteEn ? campaign.confirmNoteEn : campaign.confirmNote;
  const locked = !campaign.confirmOpen;
  const deadline = campaign.confirmDeadline ? new Date(campaign.confirmDeadline).toLocaleString(localeOf(lang), { dateStyle: "long", timeStyle: "short" }) : null;
  const card = "rounded-2xl border-border/60 shadow-lg shadow-primary/5";

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Link href={`/apply/${slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t("confirm.backToCampaign")}</Link>
      <h1 className="text-3xl font-bold mt-2 mb-2 flex items-center gap-2 [text-wrap:balance]"><ClipboardCheck className="h-7 w-7 text-primary shrink-0" />{title}</h1>
      <p className="text-muted-foreground mb-5">{t("confirm.subtitle")}</p>

      {!campaign.confirmEnabled ? (
        <Alert className="rounded-2xl"><Lock className="h-4 w-4" /><AlertDescription>{t("confirm.notOpen")}</AlertDescription></Alert>
      ) : (
        <>
          {deadline && (
            <Alert className="mb-4 rounded-2xl" variant={locked ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{locked ? t("confirm.closed") : fill(t("confirm.deadlineNote"), deadline)}</AlertDescription>
            </Alert>
          )}
          {note && <LinkifyText text={note} className="mb-6 rounded-2xl bg-primary/5 p-4 text-sm [text-wrap:pretty]" />}

          {!orders && (
            <Card className={card}>
              <CardHeader>
                <CardTitle>{t("confirm.queryTitle")}</CardTitle>
                <CardDescription>{t("confirm.queryDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <LookupForm requireStudentId={campaign.requireStudentId} loading={loading} onLookup={lookup} t={t}
                  labels={{ byStudentId: t("confirm.modeStudent"), byEmail: t("confirm.modeEmail"), byOrderNo: t("apply.byOrderNo"), orderNo: t("apply.orderNoPlaceholder"), name: t("confirm.namePlaceholder"), studentId: t("confirm.studentId"), email: t("confirm.email"), button: t("confirm.checkButton"), loading: t("confirm.checking") }} />
                {notFound && (
                  <Alert variant="destructive" className="rounded-xl"><PackageX className="h-4 w-4" /><AlertDescription>{t("confirm.notFound")}</AlertDescription></Alert>
                )}
                {lookupFail && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex flex-wrap items-center gap-3">
                      <span className="flex-1">{errText(lookupFail, t)}</span>
                      {cred && <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => lookup(cred)}>{t("apply.retry")}</Button>}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("confirm.privacyNote")}</p>
              </CardContent>
            </Card>
          )}

          {orders && cred && (
            <div className="space-y-4">
              {orders.map((o, i) => (
                <div key={o.orderNo} className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 80}ms` }}>
                  <OrderConfirmCard slug={slug} campaign={campaign} order={o} cred={cred} locked={locked} t={t} lang={lang}
                    onSaved={(u) => setOrders(orders.map((x) => (x.orderNo === u.orderNo ? u : x)))} />
                </div>
              ))}
              <Button variant="ghost" className="w-full h-11 rounded-xl" onClick={() => { setOrders(null); setCred(null); }}>{t("confirm.back")}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrderConfirmCard({ slug, campaign, order, cred, locked, t, lang, onSaved }: {
  slug: string; campaign: Campaign; order: Order; cred: Cred; locked: boolean; t: T; lang: string; onSaved: (o: Order) => void;
}) {
  const [response, setResponse] = useState<"received" | "not_received" | null>(order.confirmation ?? null);
  const [resolution, setResolution] = useState<Resolution[]>(
    order.resolution ?? order.items.map((i) => ({ ...i, choice: "pickup" as Choice })),
  );
  const [note, setNote] = useState(order.confirmNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const sameGroupNames = (group: string | null) => campaign.options.filter((o) => (o.group ?? null) === group).map((o) => o.name);
  const setRes = (idx: number, patch: Partial<Resolution>) => setResolution(resolution.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const needsIdentity = !cred.name; // 주문번호만으로 조회한 경우 — 상태 변경은 본인 확인 필요

  async function submit() {
    if (!response) return;
    setSaving(true); setError(""); setSaved(false);
    const r = await request<{ order?: Order }>(`/api/campaigns/${slug}/confirm`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cred, orderNo: order.orderNo, confirmation: response, note,
        resolution: response === "not_received" ? resolution.map((r2) => ({ optionId: r2.optionId, choice: r2.choice, exchangeName: r2.choice === "exchange" ? r2.exchangeName ?? r2.name : undefined })) : undefined,
      }),
    });
    setSaving(false); // 실패해도 선택·입력값 유지하고 버튼을 다시 연다
    if (!r.ok) { setError(errText(r, t)); return; }
    setSaved(true); onSaved(r.data.order ?? { ...order, confirmation: response, resolution, confirmNote: note, confirmedAt: new Date().toISOString() });
  }

  const choiceBtn = (active: boolean) =>
    `min-h-10 rounded-lg border px-3 text-sm transition-[background-color,color,border-color] duration-150 active:scale-[0.96] ` +
    (active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/60 hover:bg-primary/5 hover:border-primary/60");

  return (
    <Card className="rounded-2xl border-border/60 shadow-lg shadow-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{order.name} <span className="text-sm font-normal text-muted-foreground">({order.affiliation})</span></span>
          {order.confirmation && <Badge variant={order.confirmation === "received" ? "secondary" : "destructive"}>{order.confirmation === "received" ? t("confirm.received") : t("confirm.notReceived")}</Badge>}
        </CardTitle>
        <CardDescription>{t("confirm.orderTitle")} · <span className="tabular-nums tracking-wider">{order.orderNo}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-1">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5 text-sm">
              <span>{i.group ? `${i.group} · ` : ""}<strong>{i.name}</strong></span>
              <span className="text-muted-foreground tabular-nums">× {i.qty}</span>
            </li>
          ))}
          {order.items.length === 0 && <li className="text-sm text-muted-foreground">{t("confirm.noItems")}</li>}
        </ul>
        <p className="text-xs text-muted-foreground">{order.status === "delivered" ? t("confirm.recordPicked") : t("confirm.recordNotPicked")}</p>

        <div className="space-y-2">
          <Label>{t("confirm.question")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={response === "received" ? "default" : "outline"} disabled={locked} onClick={() => setResponse("received")} className="h-12 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />{t("confirm.received")}
            </Button>
            <Button type="button" variant={response === "not_received" ? "destructive" : "outline"} disabled={locked} onClick={() => setResponse("not_received")} className="h-12 rounded-xl">
              <PackageX className="h-4 w-4" />{t("confirm.notReceived")}
            </Button>
          </div>
        </div>

        {response === "not_received" && (
          <div className="space-y-3 rounded-xl bg-muted/40 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-sm [text-wrap:pretty]">{t("confirm.resolutionHelp")}</p>
            {resolution.map((r, idx) => (
              <div key={idx} className="space-y-1.5">
                <p className="text-sm font-medium">{r.group ? `${r.group} · ` : ""}{r.name} × {r.qty}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["pickup", "refund", "exchange"] as Choice[]).map((c) => (
                    <button key={c} type="button" disabled={locked} className={choiceBtn(r.choice === c)}
                      onClick={() => setRes(idx, { choice: c, exchangeName: c === "exchange" ? r.exchangeName ?? r.name : undefined })}>
                      {t(`confirm.choice_${c}`)}
                    </button>
                  ))}
                  {r.choice === "exchange" && (
                    <select className="min-h-10 rounded-lg border border-border/60 bg-background px-2 text-sm" disabled={locked} value={r.exchangeName ?? r.name}
                      onChange={(e) => setRes(idx, { exchangeName: e.target.value })}>
                      {sameGroupNames(r.group).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("confirm.refundNote")}</p>
          </div>
        )}

        {response && (
          <div className="space-y-2">
            <Label htmlFor={`note-${order.orderNo}`}>{t("confirm.note")}</Label>
            <Textarea id={`note-${order.orderNo}`} className="rounded-xl" rows={2} value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder={t("confirm.notePlaceholder")} />
          </div>
        )}

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {needsIdentity && !locked && (
          <Alert className="rounded-xl"><AlertTriangle className="h-4 w-4" /><AlertDescription>{t("confirm.needIdentity")}</AlertDescription></Alert>
        )}
        {locked ? (
          <p className="text-sm text-muted-foreground">{t("confirm.closed")}</p>
        ) : (
          <Button onClick={submit} disabled={!response || saving || needsIdentity} className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-primary/30">{saving ? t("confirm.saving") : order.confirmation ? t("confirm.update") : t("confirm.submit")}</Button>
        )}
        {saved && (
          <Alert className="rounded-xl animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{response === "received" ? t("confirm.savedReceived") : t("confirm.savedNotReceived")}</AlertDescription>
          </Alert>
        )}
        {order.confirmedAt && !saved && (
          <p className="text-xs text-muted-foreground">{t("confirm.respondedAt")}: {new Date(order.confirmedAt).toLocaleString(localeOf(lang))}</p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import type { Campaign, Cred, Order, T } from "./types";
import { localeOf } from "./types";

export const statusVariant = (s: Order["status"]) =>
  s === "paid" || s === "delivered" ? ("default" as const) : s === "cancelled" ? ("destructive" as const) : ("secondary" as const);

/** 조회 폼 (이름 + 학번/이메일). confirm 페이지와 공유 */
export function LookupForm({ requireStudentId, loading, onLookup, t, labels }: {
  requireStudentId: boolean; loading: boolean; onLookup: (c: Cred) => void; t: T;
  labels: { byStudentId: string; byEmail: string; name: string; studentId: string; email: string; button: string; loading: string };
}) {
  const [mode, setMode] = useState<"student" | "email">(requireStudentId ? "student" : "email");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const go = () => name.trim() && key.trim() && onLookup({ name: name.trim(), ...(mode === "student" ? { studentId: key.trim() } : { email: key.trim() }) });
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-9 rounded-lg" variant={mode === "student" ? "default" : "outline"} onClick={() => setMode("student")}>{labels.byStudentId}</Button>
        <Button type="button" size="sm" className="h-9 rounded-lg" variant={mode === "email" ? "default" : "outline"} onClick={() => setMode("email")}>{labels.byEmail}</Button>
      </div>
      <Input className="h-11 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} placeholder={labels.name} autoComplete="name" />
      <Input className="h-11 rounded-xl" value={key} onChange={(e) => setKey(e.target.value)} placeholder={mode === "student" ? labels.studentId : labels.email} inputMode={mode === "student" ? "numeric" : "email"} onKeyDown={(e) => e.key === "Enter" && go()} />
      <Button variant="outline" className="w-full h-11 rounded-xl" disabled={loading} onClick={go}>{loading ? labels.loading : labels.button}</Button>
      <span className="sr-only">{t("apply.privacyNote")}</span>
    </div>
  );
}

/** 내 신청 확인: 상태 뱃지, 본인 취소(2단계 인라인), 수령 확인 링크 */
export function MyOrders({ campaign, t, lang, won }: { campaign: Campaign; t: T; lang: string; won: (n: number) => string }) {
  const [openPanel, setOpenPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cred, setCred] = useState<Cred | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [arming, setArming] = useState<string | null>(null); // 취소 2단계 중인 orderNo
  const [msg, setMsg] = useState<Record<string, string>>({});

  async function lookup(c: Cred) {
    setLoading(true); setOrders(null); setCred(c);
    const res = await fetch(`/api/campaigns/${campaign.slug}/lookup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    const d = await res.json().catch(() => ({ orders: [] }));
    setLoading(false);
    setOrders(d.orders ?? []);
  }

  async function cancel(o: Order) {
    if (!cred) return;
    const res = await fetch(`/api/campaigns/${campaign.slug}/orders/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cred, orderNo: o.orderNo }) });
    const d = await res.json().catch(() => ({}));
    setArming(null);
    if (!res.ok) { setMsg({ ...msg, [o.orderNo]: d.error ?? t("apply.genericError") }); return; }
    setMsg({ ...msg, [o.orderNo]: t("apply.cancelledDone") });
    setOrders((orders ?? []).map((x) => (x.orderNo === o.orderNo ? { ...x, ...d.order, status: "cancelled", canCancel: false } : x)));
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-lg shadow-primary/5">
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpenPanel(!openPanel)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" />{t("apply.lookupTitle")}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openPanel ? "rotate-180" : ""}`} />
        </CardTitle>
        {openPanel && <CardDescription>{t("apply.lookupDesc")}</CardDescription>}
      </CardHeader>
      {openPanel && (
        <CardContent className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <LookupForm requireStudentId={campaign.requireStudentId} loading={loading} onLookup={lookup} t={t}
            labels={{ byStudentId: t("apply.byStudentId"), byEmail: t("apply.byEmail"), name: t("apply.name"), studentId: t("apply.studentId"), email: t("apply.email"), button: t("apply.lookupButton"), loading: t("apply.loading") }} />
          {orders && orders.length === 0 && <p className="text-sm text-muted-foreground">{t("apply.lookupEmpty")}</p>}
          {orders?.map((o, i) => (
            <div key={o.orderNo} className="rounded-xl border border-border/60 p-3 text-sm space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold tracking-wider tabular-nums">{o.orderNo}</span>
                <div className="flex items-center gap-1.5">
                  {o.source === "import" && <Badge variant="outline" className="text-[11px]">{t("apply.imported")}</Badge>}
                  {o.confirmation && <Badge variant={o.confirmation === "received" ? "default" : "destructive"} className="text-[11px]">{t(`apply.confirmed_${o.confirmation}`)}</Badge>}
                  <Badge variant={statusVariant(o.status)}>{t(`apply.status_${o.status}`)}</Badge>
                </div>
              </div>
              <ul className="text-muted-foreground">
                {o.items.map((it, idx) => <li key={idx}>{it.group ? `${it.group} · ` : ""}{it.name} × {it.qty}</li>)}
              </ul>
              <div className="flex justify-between"><span>{t("apply.total")}</span><span className="font-medium tabular-nums">{won(o.total)}</span></div>
              {o.status === "pending" && o.total > 0 && o.bankInfo && <p className="text-xs whitespace-pre-line select-all rounded-lg bg-muted/40 p-2">{t("apply.bank")}: {o.bankInfo}</p>}
              <p className="text-xs text-muted-foreground">{t("apply.appliedAt")}: {new Date(o.createdAt).toLocaleString(localeOf(lang))}</p>

              {msg[o.orderNo] && <p className="text-xs">{msg[o.orderNo]}</p>}
              {o.status === "pending" && o.canCancel !== false && !msg[o.orderNo] && (
                arming === o.orderNo ? (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/5 p-2">
                    <span className="text-xs flex-1">{t("apply.cancelConfirm")}</span>
                    <Button type="button" size="sm" variant="destructive" className="h-9 rounded-lg" onClick={() => cancel(o)}>{t("apply.cancelYes")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-9 rounded-lg" onClick={() => setArming(null)}>{t("apply.cancelNo")}</Button>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg text-destructive hover:text-destructive" onClick={() => setArming(o.orderNo)}>{t("apply.cancelOrder")}</Button>
                )
              )}
              {(o.status === "paid" || o.status === "delivered") && <p className="text-xs text-muted-foreground">{t("apply.cancelAfterPaid")}</p>}
            </div>
          ))}
          {campaign.confirmEnabled && orders && orders.length > 0 && (
            <Link href={`/apply/${campaign.slug}/confirm`} className="block text-center text-sm text-primary underline underline-offset-4 py-1">{t("apply.goConfirm")} →</Link>
          )}
        </CardContent>
      )}
    </Card>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, ClipboardCheck, AlertTriangle } from "lucide-react";
import type { Campaign, Cred, Order, ReqFail, T } from "./types";
import { errText, localeOf, request } from "./types";

export const statusVariant = (s: Order["status"]) =>
  s === "paid" || s === "delivered" ? ("default" as const) : s === "cancelled" ? ("destructive" as const) : ("secondary" as const);

/** 조회 폼 (이름 + 학번/이메일). confirm 페이지와 공유 */
export function LookupForm({ requireStudentId, loading, onLookup, t, labels }: {
  requireStudentId: boolean; loading: boolean; onLookup: (c: Cred) => void; t: T;
  labels: { byStudentId: string; byEmail: string; byOrderNo: string; name: string; studentId: string; email: string; orderNo: string; button: string; loading: string };
}) {
  const [mode, setMode] = useState<"student" | "email" | "orderNo">(requireStudentId ? "student" : "email");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const go = () => {
    if (mode === "orderNo") return key.trim() && onLookup({ orderNo: key.trim().toUpperCase() });
    return name.trim() && key.trim() && onLookup({ name: name.trim(), ...(mode === "student" ? { studentId: key.trim() } : { email: key.trim() }) });
  };
  const modes = [["student", labels.byStudentId], ["email", labels.byEmail], ["orderNo", labels.byOrderNo]] as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {modes.map(([m, label]) => (
          <Button key={m} type="button" size="sm" className="h-9 rounded-lg" variant={mode === m ? "default" : "outline"} onClick={() => { setMode(m); setKey(""); }}>{label}</Button>
        ))}
      </div>
      {mode !== "orderNo" && <Input className="h-11 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} placeholder={labels.name} autoComplete="name" />}
      <Input className={`h-11 rounded-xl ${mode === "orderNo" ? "uppercase tracking-wider" : ""}`} value={key} onChange={(e) => setKey(e.target.value)} placeholder={mode === "student" ? labels.studentId : mode === "email" ? labels.email : labels.orderNo} inputMode={mode === "student" ? "numeric" : mode === "email" ? "email" : "text"} onKeyDown={(e) => e.key === "Enter" && go()} />
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
  const [code, setCode] = useState(""); // 취소용 관리 코드
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [fail, setFail] = useState<ReqFail | null>(null);
  const [lastCred, setLastCred] = useState<Cred | null>(null);

  async function lookup(c: Cred) {
    setLoading(true); setOrders(null); setFail(null); setCred(c); setLastCred(c);
    const r = await request<{ orders: Order[] }>(`/api/campaigns/${campaign.slug}/lookup`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c),
    });
    setLoading(false);
    if (!r.ok) { setFail(r); return; } // 통신 실패를 "내역 없음"으로 보여 주지 않는다
    setOrders(r.data.orders ?? []);
  }

  async function cancel(o: Order) {
    if (!code.trim()) { setErr({ ...err, [o.orderNo]: t("apply.cancelCodeRequired") }); return; }
    setErr({ ...err, [o.orderNo]: "" });
    const r = await request<{ order: Order }>(`/api/campaigns/${campaign.slug}/orders/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(cred ?? {}), orderNo: o.orderNo, manageCode: code.trim().toUpperCase() }),
    });
    if (!r.ok) {
      // 서버는 주문번호 열거 방지를 위해 "없음"과 "코드 불일치"를 모두 404 로 돌려준다.
      const m = r.status === 409 ? t("apply.cancelTooLate")
        : [401, 403, 404].includes(r.status) ? t("apply.cancelCodeWrong")
          : errText(r, t);
      setErr({ ...err, [o.orderNo]: m });
      return;
    }
    setArming(null); setCode("");
    setMsg({ ...msg, [o.orderNo]: t("apply.cancelledDone") });
    setOrders((orders ?? []).map((x) => (x.orderNo === o.orderNo ? { ...x, ...r.data.order, status: "cancelled", canCancel: false } : x)));
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
            labels={{ byStudentId: t("apply.byStudentId"), byEmail: t("apply.byEmail"), byOrderNo: t("apply.byOrderNo"), name: t("apply.name"), studentId: t("apply.studentId"), email: t("apply.email"), orderNo: t("apply.orderNoPlaceholder"), button: t("apply.lookupButton"), loading: t("apply.loading") }} />
          {fail && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span className="flex-1">{errText(fail, t)}</span>
                {lastCred && <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => lookup(lastCred)}>{t("apply.retry")}</Button>}
              </AlertDescription>
            </Alert>
          )}
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
                  <div className="space-y-2 rounded-lg bg-destructive/5 p-2">
                    <p className="text-xs">{t("apply.cancelConfirm")}</p>
                    <Input className="h-10 rounded-lg uppercase tracking-wider" value={code} onChange={(e) => setCode(e.target.value)}
                      placeholder={t("apply.cancelCodePlaceholder")} aria-label={t("apply.cancelCodeLabel")} onKeyDown={(e) => e.key === "Enter" && cancel(o)} />
                    {err[o.orderNo] && <p className="text-xs text-destructive" role="alert">{err[o.orderNo]}</p>}
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="destructive" className="h-9 rounded-lg" onClick={() => cancel(o)}>{t("apply.cancelYes")}</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-9 rounded-lg" onClick={() => { setArming(null); setCode(""); }}>{t("apply.cancelNo")}</Button>
                      <span className="text-[11px] text-muted-foreground flex-1">{t("apply.cancelCodeLost")}</span>
                    </div>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg text-destructive hover:text-destructive" onClick={() => { setArming(o.orderNo); setCode(""); }}>{t("apply.cancelOrder")}</Button>
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

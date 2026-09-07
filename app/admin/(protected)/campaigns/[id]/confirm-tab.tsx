"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type Campaign, type Order, CHOICE_LABEL, STATUS_LABEL,
  copyEmails, itemLabel, parseItems, parseResolution, putOrder,
  needsRefund,
} from "./types";

type Filter = "unconfirmed" | "received" | "not_received" | "all";

/** 수령 확인 탭 — 응답 현황, 못 받음 집계, 처리 완료 토글. */
export function ConfirmTab({ c, orders, reload }: { c: Campaign; orders: Order[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<Filter>("unconfirmed");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const live = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);
  const counts = useMemo(() => ({
    all: live.length,
    unconfirmed: live.filter((o) => !o.confirmation).length,
    received: live.filter((o) => o.confirmation === "received").length,
    not_received: live.filter((o) => o.confirmation === "not_received").length,
  }), [live]);

  const visible = live.filter((o) => filter === "all" || (filter === "unconfirmed" ? !o.confirmation : o.confirmation === filter));

  // 못 받음 집계 (처리 완료 제외) — 색·사이즈·희망 처리별 벌 수
  const shortage = useMemo(() => {
    const m = new Map<string, number>();
    live.filter((o) => o.confirmation === "not_received" && !o.resolvedAt).forEach((o) => {
      const res = parseResolution(o) ?? parseItems(o).map((it) => ({ ...it, choice: "pickup" as const }));
      res.forEach((r) => {
        const k = `${itemLabel(r)} · ${CHOICE_LABEL[r.choice]}${r.choice === "exchange" && r.exchangeName ? `→${r.exchangeName}` : ""}`;
        m.set(k, (m.get(k) ?? 0) + r.qty);
      });
    });
    return [...m.entries()].sort();
  }, [live]);

  async function put(body: object) {
    setBusy(true);
    await putOrder(c.id, body);
    await reload();
    setBusy(false);
  }
  async function memo(o: Order) {
    const v = prompt("관리자 메모", o.adminMemo ?? "");
    if (v === null) return;
    await put({ orderId: o.id, adminMemo: v });
  }
  async function copy() {
    const n = await copyEmails(visible);
    setCopied(`${n}명 복사됨 (현재 필터 ${visible.length}건)`);
    setTimeout(() => setCopied(""), 2500);
  }

  const cards: [Filter, string, number][] = [
    ["unconfirmed", "미응답", counts.unconfirmed],
    ["received", "받음", counts.received],
    ["not_received", "못 받음", counts.not_received],
    ["all", "전체", counts.all],
  ];

  return (
    <div className="space-y-4">
      {!c.confirmEnabled && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          수령 확인이 꺼져 있습니다. 설정 탭에서 켜면 <code className="text-xs">/apply/{c.slug}/confirm</code> 이 열립니다.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cards.map(([k, label, n]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md border p-3 text-left ${filter === k ? "ring-2 ring-primary" : ""}`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold tabular-nums">{n}</div>
          </button>
        ))}
      </div>

      {shortage.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">못 받음 집계 (처리 완료 제외) — 색·사이즈·희망 처리별 벌 수</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {shortage.map(([k, n]) => <Badge key={k} variant="destructive" className="text-sm">{k}: <strong className="ml-1">{n}</strong></Badge>)}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled={visible.length === 0} onClick={copy}>이메일 복사 (현재 필터 {visible.length}건)</Button>
        {copied && <span className="text-sm text-muted-foreground">{copied}</span>}
      </div>

      <div className="space-y-2">
        {visible.map((o) => {
          const res = parseResolution(o);
          return (
            <Card key={o.id}>
              <CardContent className="p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{o.orderNo}</span>
                    <span className="font-medium">{o.name}</span>
                    <Badge variant="secondary" className="text-xs">{o.affiliation}</Badge>
                    <Badge variant="outline" className="text-xs">{STATUS_LABEL[o.status]}</Badge>
                    {o.confirmation === "received" && <Badge className="text-xs">받음</Badge>}
                    {o.confirmation === "not_received" && <Badge variant="destructive" className="text-xs">못 받음</Badge>}
                    {!o.confirmation && <Badge variant="outline" className="text-xs">미응답</Badge>}
                    {o.resolvedAt && <Badge className="text-xs">처리 완료</Badge>}
                    {o.handedBy && <Badge variant="outline" className="text-xs">배부: {o.handedBy}</Badge>}
                    {o.refundedAt && <Badge className="text-xs bg-emerald-600 text-white">환불 완료</Badge>}
                    {needsRefund(o) && !o.refundedAt && <Badge variant="destructive" className="text-xs">환불 필요</Badge>}
                  </div>
                  <div className="text-muted-foreground">{o.email}{o.phone ? ` · ${o.phone}` : ""}</div>
                  <div>{parseItems(o).map((it) => `${itemLabel(it)}×${it.qty}`).join(", ")}</div>
                  {res && <div className="text-xs">희망 처리: {res.map((r) => `${itemLabel(r)}×${r.qty} ${CHOICE_LABEL[r.choice]}${r.choice === "exchange" && r.exchangeName ? `→${r.exchangeName}` : ""}`).join(", ")}</div>}
                  {o.confirmNote && <div className="text-xs">확인 메모: {o.confirmNote}</div>}
                  {o.adminMemo && <div className="text-xs text-muted-foreground">관리자: {o.adminMemo}</div>}
                  {o.confirmedAt && <div className="text-xs text-muted-foreground">응답 {new Date(o.confirmedAt).toLocaleString("ko-KR")}</div>}
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  {o.confirmation === "not_received" && (o.resolvedAt
                    ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ orderId: o.id, resolved: false })}>처리 완료 취소</Button>
                    : <Button size="sm" variant="secondary" disabled={busy} onClick={() => put({ orderId: o.id, resolved: true })}>처리 완료</Button>)}
                  {(needsRefund(o) || o.refundedAt) && (o.refundedAt
                    ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ orderId: o.id, refunded: false })}>환불 완료 취소</Button>
                    : <Button size="sm" variant="secondary" disabled={busy} onClick={() => put({ orderId: o.id, refunded: true })}>환불 완료</Button>)}
                  {!o.confirmation && <>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => put({ orderId: o.id, confirmation: "received" })}>받음으로</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => put({ orderId: o.id, confirmation: "not_received" })}>못 받음으로</Button>
                  </>}
                  {o.confirmation && <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ orderId: o.id, confirmation: null })}>응답 초기화</Button>}
                  <Button size="sm" variant="ghost" onClick={() => memo(o)}>메모</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">해당하는 신청이 없습니다.</p>}
      </div>
      <p className="text-xs text-muted-foreground">전화·카톡으로 받은 회신은 「받음으로 / 못 받음으로」 버튼으로 대신 기록할 수 있습니다.</p>
    </div>
  );
}

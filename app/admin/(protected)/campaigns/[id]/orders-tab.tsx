"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ImportSection } from "./import-section";
import {
  type Campaign, type Order, type Status, STATUS_LABEL, STATUS_VARIANT, CHOICE_LABEL,
  parseItems, parseResolution, itemLabel,
} from "./types";

type Filter = "all" | Status | "unconfirmed" | "received" | "not_received";

export function OrdersTab({ c, orders, reload }: { c: Campaign; orders: Order[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "status" | "total">("newest");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState("");
  const [pendingBulk, setPendingBulk] = useState<Status | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<{ optionId: number; qty: number }[]>([]);

  // 정산 — 전체 기준 (필터 무관)
  const settle = useMemo(() => ({
    paidAmount: orders.filter((o) => o.status === "paid" || o.status === "delivered").reduce((a, o) => a + o.total, 0),
    pendingAmount: orders.filter((o) => o.status === "pending").reduce((a, o) => a + o.total, 0),
    deliveredQty: orders.filter((o) => o.status === "delivered").reduce((a, o) => a + parseItems(o).reduce((b, it) => b + it.qty, 0), 0),
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }), [orders]);

  const adjust = useMemo<Record<string, number>>(() => { try { return c.priceAdjust ? JSON.parse(c.priceAdjust) : {}; } catch { return {}; } }, [c.priceAdjust]);
  const editableOptions = c.options.filter((op) => op.enabled && op.id);
  const unitPrice = (optionId: number, affiliation: string) => (editableOptions.find((op) => op.id === optionId)?.price ?? 0) + (adjust[affiliation] ?? 0);

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    paid: orders.filter((o) => o.status === "paid").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    unconfirmed: orders.filter((o) => o.status !== "cancelled" && !o.confirmation).length,
    received: orders.filter((o) => o.confirmation === "received").length,
    not_received: orders.filter((o) => o.confirmation === "not_received").length,
  }), [orders]);

  const STATUS_RANK: Record<Status, number> = { pending: 0, paid: 1, delivered: 2, cancelled: 3 };
  const visible = orders.filter((o) => {
    if (filter === "unconfirmed") { if (o.status === "cancelled" || o.confirmation) return false; }
    else if (filter === "received" || filter === "not_received") { if (o.confirmation !== filter) return false; }
    else if (filter !== "all" && o.status !== filter) return false;
    return !q || `${o.name} ${o.email} ${o.orderNo} ${o.affiliation}`.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => {
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (sort === "name") return a.name.localeCompare(b.name, "ko") || b.createdAt.localeCompare(a.createdAt);
    if (sort === "status") return STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt.localeCompare(a.createdAt);
    if (sort === "total") return b.total - a.total || b.createdAt.localeCompare(a.createdAt);
    return b.createdAt.localeCompare(a.createdAt);
  });

  // 옵션별 합계 (취소 제외) — 발주표
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => o.status !== "cancelled").forEach((o) =>
      parseItems(o).forEach((it) => { const k = itemLabel(it); m.set(k, (m.get(k) ?? 0) + it.qty); }));
    const order = new Map(c.options.map((op, i) => [itemLabel({ group: op.group || null, name: op.name }), i]));
    return [...m.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999));
  }, [orders, c.options]);

  // 못 받음 집계 (그룹·이름·선택별)
  const shortage = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => o.confirmation === "not_received" && !o.resolvedAt).forEach((o) => {
      const res = parseResolution(o) ?? parseItems(o).map((it) => ({ ...it, choice: "pickup" as const }));
      res.forEach((r) => {
        const k = `${itemLabel(r)} · ${CHOICE_LABEL[r.choice]}${r.choice === "exchange" && r.exchangeName ? `→${r.exchangeName}` : ""}`;
        m.set(k, (m.get(k) ?? 0) + r.qty);
      });
    });
    return [...m.entries()].sort();
  }, [orders]);

  const importCount = orders.filter((o) => o.source === "import").length;

  async function put(body: object) {
    setBusy(true);
    await fetch(`/api/admin/campaigns/${c.id}/orders`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await reload();
    setBusy(false);
  }
  const setStatus = (o: Order, status: Status) => put({ orderId: o.id, status });
  async function bulk(status: Status) {
    await put({ orderIds: [...selected], status });
    setSelected(new Set()); setPendingBulk(null);
  }
  async function editDepositor(o: Order) {
    const v = prompt("입금자명 (비우면 이름과 동일)", o.depositorName ?? "");
    if (v === null) return;
    await put({ orderId: o.id, depositorName: v });
  }
  const startEdit = (o: Order) => { setEditId(o.id); setEditItems(parseItems(o).map((it) => ({ optionId: it.optionId, qty: it.qty }))); };
  async function saveEdit(o: Order) {
    const items = editItems.filter((it) => it.optionId && it.qty >= 1);
    if (!items.length) return;
    await put({ orderId: o.id, items });
    setEditId(null);
  }
  async function editMemo(o: Order) {
    const v = prompt("관리자 메모", o.adminMemo ?? "");
    if (v === null) return;
    await put({ orderId: o.id, adminMemo: v });
  }
  async function copyEmails(rows: Order[]) {
    const emails = [...new Set(rows.map((o) => o.email.trim().toLowerCase()).filter(Boolean))];
    await navigator.clipboard.writeText(emails.join(", "));
    setCopied(`${emails.length}개 복사됨`);
    setTimeout(() => setCopied(""), 2500);
  }
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisibleSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((o) => o.id)));

  const filterCards: [Filter, string, number][] = [
    ["all", "전체", counts.all], ["pending", "대기", counts.pending], ["paid", "입금", counts.paid], ["delivered", "수령", counts.delivered], ["cancelled", "취소", counts.cancelled],
    ...(c.confirmEnabled ? ([["unconfirmed", "미응답", counts.unconfirmed], ["received", "받음", counts.received], ["not_received", "못 받음", counts.not_received]] as [Filter, string, number][]) : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          ["입금 확인 금액", `${settle.paidAmount.toLocaleString("ko-KR")}원`, "text-emerald-600"],
          ["입금 대기 금액", `${settle.pendingAmount.toLocaleString("ko-KR")}원`, "text-amber-600"],
          ["수령 완료", `${settle.deliveredQty.toLocaleString("ko-KR")}벌`, ""],
          ["취소", `${settle.cancelled}건`, "text-muted-foreground"],
        ] as [string, string, string][]).map(([label, v, cls]) => (
          <Card key={label}><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-lg sm:text-xl font-bold tabular-nums ${cls}`}>{v}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {filterCards.map(([k, label, n]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md border p-2 sm:p-3 text-left ${filter === k ? "ring-2 ring-primary" : ""} ${k === "unconfirmed" ? "border-l-4 border-l-amber-400" : ""}`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg sm:text-xl font-bold">{n}</div>
          </button>
        ))}
      </div>

      {totals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">옵션별 합계 (취소 제외) — 발주표</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {totals.map(([k, n]) => <Badge key={k} variant="outline" className="text-sm">{k}: <strong className="ml-1">{n}</strong></Badge>)}
          </CardContent>
        </Card>
      )}
      {shortage.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">못 받음 집계 (처리 완료 제외) (색·사이즈·선택별 벌 수)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {shortage.map(([k, n]) => <Badge key={k} variant="destructive" className="text-sm">{k}: <strong className="ml-1">{n}</strong></Badge>)}
          </CardContent>
        </Card>
      )}

      <ImportSection campaignId={c.id} importCount={importCount} onDone={reload} />

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="이름·이메일·주문번호 검색" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="정렬">
          <option value="newest">최신순</option><option value="oldest">오래된순</option><option value="name">이름순</option><option value="status">상태순</option><option value="total">금액순</option>
        </select>
        <Button size="sm" variant="outline" disabled={visible.length === 0} onClick={() => copyEmails(visible)}>이메일 복사 (현재 필터)</Button>
        {copied && <span className="text-sm text-muted-foreground">{copied}</span>}
        <a className="text-sm underline ml-auto" href={`/api/admin/campaigns/${c.id}/orders?format=csv`}>CSV 내보내기</a>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 rounded-md border bg-background/95 backdrop-blur p-2 flex flex-wrap items-center gap-2 shadow-sm">
          <span className="text-sm font-medium mr-1">{selected.size}건 선택:</span>
          {pendingBulk ? (
            <>
              <span className="text-sm">「{STATUS_LABEL[pendingBulk]}」(으)로 바꿀까요?</span>
              <Button size="sm" disabled={busy} onClick={() => bulk(pendingBulk)}>네</Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingBulk(null)}>아니오</Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => setPendingBulk("paid")}>입금 확인</Button>
              <Button size="sm" variant="outline" onClick={() => setPendingBulk("pending")}>입금 취소 (대기로)</Button>
              <Button size="sm" onClick={() => setPendingBulk("delivered")}>수령 완료</Button>
              <Button size="sm" variant="destructive" onClick={() => setPendingBulk("cancelled")}>취소</Button>
              <Button size="sm" variant="outline" onClick={() => copyEmails(orders.filter((o) => selected.has(o.id)))}>선택 이메일 복사</Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>선택 해제</Button>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} /> 전체 선택 · {visible.length}건 표시
      </div>

      <div className="space-y-2">
        {visible.map((o) => {
          const res = parseResolution(o);
          return (
            <Card key={o.id} className={selected.has(o.id) ? "ring-2 ring-primary/60" : ""}>
              <CardContent className="p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="pt-1"><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} /></div>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{o.orderNo}</span>
                    <span className="font-medium">{o.name}</span>
                    <Badge variant="secondary" className="text-xs">{o.affiliation}</Badge>
                    <Badge variant={STATUS_VARIANT[o.status]} className="text-xs">{STATUS_LABEL[o.status]}</Badge>
                    {o.source === "import" && <Badge variant="outline" className="text-xs">적재</Badge>}
                    {o.confirmation === "received" && <Badge className="text-xs bg-emerald-600 text-white">받음</Badge>}
                    {o.confirmation === "not_received" && <Badge variant="destructive" className="text-xs">못 받음</Badge>}
                    {o.resolvedAt && <Badge className="text-xs bg-emerald-600 text-white">처리 완료</Badge>}
                  </div>
                  <div className="text-muted-foreground">{o.email}{o.phone ? ` · ${o.phone}` : ""}</div>
                  {o.depositorName && o.depositorName.trim() !== o.name.trim() && (
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400">입금자명: {o.depositorName}</div>
                  )}
                  {editId === o.id ? (
                    <div className="mt-1 space-y-1 rounded-md border bg-muted/30 p-2">
                      {editItems.map((it, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <select className="h-8 flex-1 min-w-0 rounded-md border bg-background px-1 text-xs" value={it.optionId}
                            onChange={(e) => setEditItems(editItems.map((x, j) => (j === i ? { ...x, optionId: Number(e.target.value) } : x)))}>
                            {editableOptions.map((op) => <option key={op.id} value={op.id}>{itemLabel({ group: op.group || null, name: op.name })} ({op.price.toLocaleString("ko-KR")}원)</option>)}
                          </select>
                          <input type="number" min={1} className="h-8 w-14 rounded-md border bg-background px-1 text-xs" value={it.qty}
                            onChange={(e) => setEditItems(editItems.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                          <button type="button" className="px-1 text-xs text-destructive" onClick={() => setEditItems(editItems.filter((_, j) => j !== i))}>삭제</button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" disabled={!editableOptions.length} onClick={() => setEditItems([...editItems, { optionId: editableOptions[0]?.id ?? 0, qty: 1 }])}>줄 추가</Button>
                        <span className="text-xs">합계 <strong>{editItems.reduce((a, it) => a + unitPrice(it.optionId, o.affiliation) * it.qty, 0).toLocaleString("ko-KR")}원</strong></span>
                        <Button size="sm" disabled={busy || !editItems.length} onClick={() => saveEdit(o)}>저장</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>취소</Button>
                      </div>
                    </div>
                  ) : (
                    <div>{parseItems(o).map((it) => `${itemLabel(it)}×${it.qty}`).join(", ")} · <strong>{o.total.toLocaleString("ko-KR")}원</strong></div>
                  )}
                  {res && <div className="text-xs">처리 선택: {res.map((r) => `${itemLabel(r)}×${r.qty} ${CHOICE_LABEL[r.choice]}${r.choice === "exchange" && r.exchangeName ? `→${r.exchangeName}` : ""}`).join(", ")}</div>}
                  {o.confirmNote && <div className="text-xs">확인 메모: {o.confirmNote}</div>}
                  {o.note && <div className="text-xs">메모: {o.note}</div>}
                  {o.adminMemo && <div className="text-xs text-muted-foreground">관리자: {o.adminMemo}</div>}
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("ko-KR")}{o.confirmedAt && ` · 확인 ${new Date(o.confirmedAt).toLocaleString("ko-KR")}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  {o.status === "pending" && <Button size="sm" disabled={busy} onClick={() => setStatus(o, "paid")}>입금 확인</Button>}
                  {o.status === "paid" && <>
                    <Button size="sm" disabled={busy} onClick={() => setStatus(o, "delivered")}>수령</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(o, "pending")}>입금 취소</Button>
                  </>}
                  {o.status === "delivered" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(o, "paid")}>수령 취소</Button>}
                  {o.status === "cancelled"
                    ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(o, "pending")}>복구</Button>
                    : cancelId === o.id
                      ? <><Button size="sm" variant="destructive" disabled={busy} onClick={() => { setCancelId(null); setStatus(o, "cancelled"); }}>정말 취소</Button><Button size="sm" variant="ghost" onClick={() => setCancelId(null)}>아니오</Button></>
                      : <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelId(o.id)}>취소</Button>}
                  {o.confirmation === "not_received" && (o.resolvedAt
                    ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ orderId: o.id, resolved: false })}>처리 완료 취소</Button>
                    : <Button size="sm" variant="secondary" disabled={busy} onClick={() => put({ orderId: o.id, resolved: true })}>처리 완료</Button>)}
                  <Button size="sm" variant="ghost" onClick={() => editMemo(o)}>메모</Button>
                  <Button size="sm" variant="ghost" onClick={() => editDepositor(o)}>입금자명</Button>
                  {o.status !== "cancelled" && editId !== o.id && <Button size="sm" variant="ghost" onClick={() => startEdit(o)}>항목 수정</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">표시할 신청이 없습니다.</p>}
      </div>
    </div>
  );
}

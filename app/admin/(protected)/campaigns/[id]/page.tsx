"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminGuide } from "@/components/admin-guide";

interface Option { id?: number; group: string; name: string; nameEn: string; price: number; stock: number | null; order: number; enabled: boolean }
interface Campaign {
  id: number; slug: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null;
  enabled: boolean; opensAt: string | null; closesAt: string | null; bankInfo: string | null; afterNote: string | null; afterNoteEn: string | null;
  allowQty: boolean; maxPerPerson: number | null; requireStudentId: boolean; priceAdjust: string | null;
  options: Option[];
}
interface OrderItem { optionId: number; group: string | null; name: string; qty: number; unitPrice: number }
type Status = "pending" | "paid" | "delivered" | "cancelled";
interface Order {
  id: number; orderNo: string; affiliation: string; name: string; email: string; phone: string | null;
  items: OrderItem[] | string; total: number; status: Status; note: string | null; adminMemo: string | null; createdAt: string;
}

const ADJ_KEYS = ["대학원생", "교수님", "졸업생", "기타"] as const;
const STATUS_LABEL: Record<Status, string> = { pending: "대기", paid: "입금", delivered: "수령", cancelled: "취소" };
const STATUS_VARIANT: Record<Status, "outline" | "secondary" | "default" | "destructive"> = { pending: "outline", paid: "secondary", delivered: "default", cancelled: "destructive" };
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];

// datetime-local ↔ ISO (로컬 시간 기준)
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const parseItems = (o: Order): OrderItem[] => (typeof o.items === "string" ? JSON.parse(o.items) : o.items);

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<"settings" | "orders">("settings");
  const [c, setC] = useState<Campaign | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/campaigns/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const camp: Campaign = data.campaign ?? data;
    setC({ ...camp, options: (camp.options ?? []).map((o) => ({ ...o, group: o.group ?? "", nameEn: o.nameEn ?? "" })) });
  }
  async function loadOrders() {
    const res = await fetch(`/api/admin/campaigns/${id}/orders`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.orders ?? []);
  }
  useEffect(() => { Promise.resolve().then(() => { load(); loadOrders(); }); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <div className="container mx-auto px-4 py-8 max-w-5xl text-sm text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:text-foreground">← 캠페인 목록</Link>
        <h1 className="text-2xl font-bold truncate">{c.title}</h1>
        <a className="text-sm underline text-muted-foreground" href={`/apply/${c.slug}`} target="_blank" rel="noreferrer">/apply/{c.slug}</a>
      </div>

      <AdminGuide id={`campaign-${c.id}`} title="캠페인 관리 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>설정</strong>: 기간·계좌·옵션을 채우고 <strong>공개</strong>를 켠 뒤 <strong>저장</strong>. 계좌는 신청 완료 화면에만 표시됩니다.</li>
          <li><strong>옵션</strong>: 재고를 비우면 무제한. 주문에 쓰인 옵션은 삭제 대신 「사용」 해제됩니다.</li>
          <li><strong>신청 목록</strong>: 입금 확인 시 <strong>입금</strong>, 전달 시 <strong>수령</strong>. 취소된 건은 재고에서 빠집니다.</li>
          <li><strong>이메일 복사</strong>는 현재 필터에 보이는 사람들의 이메일만 복사합니다. Gmail 받는 사람 칸에 붙여넣으세요.</li>
        </ol>
      </AdminGuide>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === "settings" ? "default" : "outline"} size="sm" onClick={() => setTab("settings")}>설정</Button>
        <Button variant={tab === "orders" ? "default" : "outline"} size="sm" onClick={() => setTab("orders")}>신청 목록 ({orders.length})</Button>
      </div>

      {tab === "settings" ? (
        <SettingsTab c={c} setC={setC} busy={busy} setBusy={setBusy} msg={msg} setMsg={setMsg} onSaved={load} />
      ) : (
        <OrdersTab campaignId={c.id} options={c.options} orders={orders} reload={loadOrders} />
      )}
    </div>
  );
}

function SettingsTab({ c, setC, busy, setBusy, msg, setMsg, onSaved }: {
  c: Campaign; setC: (c: Campaign) => void; busy: boolean; setBusy: (b: boolean) => void; msg: string; setMsg: (m: string) => void; onSaved: () => Promise<void>;
}) {
  const [bulk, setBulk] = useState("");
  const adj = useMemo<Record<string, number>>(() => { try { return c.priceAdjust ? JSON.parse(c.priceAdjust) : {}; } catch { return {}; } }, [c.priceAdjust]);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC({ ...c, [k]: v });
  const setOpt = (i: number, patch: Partial<Option>) => set("options", c.options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setAdj = (k: string, v: string) => {
    const next = { ...adj };
    if (v === "" || Number(v) === 0) delete next[k]; else next[k] = Number(v);
    set("priceAdjust", Object.keys(next).length ? JSON.stringify(next) : null);
  };

  function addBulk(text: string) {
    const start = c.options.length;
    const added: Option[] = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => {
      const [group = "", name = "", price = "0", stock = ""] = l.split(",").map((s) => s.trim());
      return { group, name, nameEn: "", price: Number(price) || 0, stock: stock === "" ? null : Number(stock), order: start + i, enabled: true };
    }).filter((o) => o.name);
    set("options", [...c.options, ...added]);
    setBulk("");
  }
  const tshirtPreset = () =>
    addBulk(["흰색", "검정"].flatMap((g) => SIZES.map((s) => `${g},${s},${["2XL", "3XL", "4XL"].includes(s) ? 9500 : 8000},`)).join("\n"));

  async function save() {
    setBusy(true); setMsg("");
    const res = await fetch(`/api/admin/campaigns/${c.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, options: c.options.map((o) => ({ ...o, group: o.group || null, nameEn: o.nameEn || null })) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "저장 실패"); return; }
    setMsg("저장됨"); await onSaved();
  }
  async function remove() {
    if (!confirm("캠페인을 삭제할까요? 신청이 있으면 삭제되지 않습니다.")) return;
    const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: "DELETE" });
    if (res.ok) location.href = "/admin/campaigns";
    else setMsg((await res.json().catch(() => ({}))).error ?? "삭제 실패");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>제목</Label><Input value={c.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>제목 (EN)</Label><Input value={c.titleEn ?? ""} onChange={(e) => set("titleEn", e.target.value || null)} /></div>
          <div className="space-y-1"><Label>주소 (slug)</Label><Input value={c.slug} onChange={(e) => set("slug", e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} /></div>
          <div className="flex items-center gap-4 pt-5 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={c.enabled} onCheckedChange={(v) => set("enabled", v === true)} /> 공개</label>
            <label className="flex items-center gap-2"><Checkbox checked={c.allowQty} onCheckedChange={(v) => set("allowQty", v === true)} /> 수량 선택 허용</label>
            <label className="flex items-center gap-2"><Checkbox checked={c.requireStudentId} onCheckedChange={(v) => set("requireStudentId", v === true)} /> 학번 필수</label>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label>설명</Label><Textarea rows={4} value={c.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>설명 (EN)</Label><Textarea rows={3} value={c.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value || null)} /></div>
          <div className="space-y-1"><Label>시작 (비우면 즉시)</Label><Input type="datetime-local" value={toLocal(c.opensAt)} onChange={(e) => set("opensAt", toIso(e.target.value))} /></div>
          <div className="space-y-1"><Label>마감 (비우면 무기한)</Label><Input type="datetime-local" value={toLocal(c.closesAt)} onChange={(e) => set("closesAt", toIso(e.target.value))} /></div>
          <div className="space-y-1"><Label>1인 최대 수량 (비우면 무제한)</Label><Input type="number" min={1} value={c.maxPerPerson ?? ""} onChange={(e) => set("maxPerPerson", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-1"><Label>입금 계좌 (완료 화면에만 표시)</Label><Input value={c.bankInfo ?? ""} onChange={(e) => set("bankInfo", e.target.value || null)} placeholder="예: 카카오뱅크 3333-00-0000000 홍길동" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>완료 안내</Label><Textarea rows={2} value={c.afterNote ?? ""} onChange={(e) => set("afterNote", e.target.value || null)} placeholder="예: 입금자명은 본인 이름으로. 수령은 종강 직전 학생회실(N7)." /></div>
          <div className="space-y-1 sm:col-span-2"><Label>완료 안내 (EN)</Label><Textarea rows={2} value={c.afterNoteEn ?? ""} onChange={(e) => set("afterNoteEn", e.target.value || null)} /></div>
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
        <CardHeader><CardTitle className="text-base">옵션 ({c.options.length})</CardTitle></CardHeader>
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
              <Button size="sm" variant="ghost" onClick={() => set("options", c.options.filter((_, j) => j !== i))}>✕</Button>
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

      <div className="flex items-center gap-3">
        <Button disabled={busy} onClick={save}>{busy ? "저장 중..." : "저장"}</Button>
        <Button variant="destructive" size="sm" onClick={remove}>캠페인 삭제</Button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}

function OrdersTab({ campaignId, options, orders, reload }: { campaignId: number; options: Option[]; orders: Order[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    paid: orders.filter((o) => o.status === "paid").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }), [orders]);

  const visible = orders.filter((o) =>
    (filter === "all" || o.status === filter) &&
    (!q || `${o.name} ${o.email} ${o.orderNo} ${o.affiliation}`.toLowerCase().includes(q.toLowerCase())),
  );

  // 옵션별 합계 (취소 제외) — 발주표
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => o.status !== "cancelled").forEach((o) =>
      parseItems(o).forEach((it) => { const k = `${it.group ? it.group + " " : ""}${it.name}`; m.set(k, (m.get(k) ?? 0) + it.qty); }));
    const order = new Map(options.map((op, i) => [`${op.group ? op.group + " " : ""}${op.name}`, i]));
    return [...m.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999));
  }, [orders, options]);

  async function setStatus(o: Order, status: Status) {
    await fetch(`/api/admin/campaigns/${campaignId}/orders`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o.id, status }) });
    await reload();
  }
  async function editMemo(o: Order) {
    const v = prompt("관리자 메모", o.adminMemo ?? "");
    if (v === null) return;
    await fetch(`/api/admin/campaigns/${campaignId}/orders`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o.id, adminMemo: v }) });
    await reload();
  }
  async function copyEmails() {
    const emails = [...new Set(visible.map((o) => o.email.trim().toLowerCase()).filter(Boolean))];
    await navigator.clipboard.writeText(emails.join(", "));
    setCopied(`${emails.length}개 복사됨`);
    setTimeout(() => setCopied(""), 2500);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {(["all", "pending", "paid", "delivered", "cancelled"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md border p-3 text-left ${filter === k ? "ring-2 ring-primary" : ""}`}>
            <div className="text-xs text-muted-foreground">{k === "all" ? "전체" : STATUS_LABEL[k]}</div>
            <div className="text-xl font-bold">{counts[k]}</div>
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

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="이름·이메일·주문번호 검색" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline" disabled={visible.length === 0} onClick={copyEmails}>이메일 복사</Button>
        {copied && <span className="text-sm text-muted-foreground">{copied}</span>}
        <a className="text-sm underline ml-auto" href={`/api/admin/campaigns/${campaignId}/orders?format=csv`}>CSV 내보내기</a>
      </div>
      <p className="text-sm text-muted-foreground">{visible.length}건 표시</p>

      <div className="space-y-2">
        {visible.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{o.orderNo}</span>
                  <span className="font-medium">{o.name}</span>
                  <Badge variant="secondary" className="text-xs">{o.affiliation}</Badge>
                  <Badge variant={STATUS_VARIANT[o.status]} className="text-xs">{STATUS_LABEL[o.status]}</Badge>
                </div>
                <div className="text-muted-foreground">{o.email}{o.phone ? ` · ${o.phone}` : ""}</div>
                <div>{parseItems(o).map((it) => `${it.group ? it.group + " " : ""}${it.name}×${it.qty}`).join(", ")} · <strong>{o.total.toLocaleString("ko-KR")}원</strong></div>
                {o.note && <div className="text-xs">메모: {o.note}</div>}
                {o.adminMemo && <div className="text-xs text-muted-foreground">관리자: {o.adminMemo}</div>}
                <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("ko-KR")}</div>
              </div>
              <div className="flex flex-wrap gap-1 shrink-0">
                {o.status === "pending" && <Button size="sm" onClick={() => setStatus(o, "paid")}>입금</Button>}
                {o.status === "paid" && <Button size="sm" onClick={() => setStatus(o, "delivered")}>수령</Button>}
                {o.status === "delivered" && <Button size="sm" variant="outline" onClick={() => setStatus(o, "paid")}>수령 취소</Button>}
                {o.status !== "cancelled"
                  ? <Button size="sm" variant="destructive" onClick={() => confirm("이 신청을 취소할까요? 재고가 복구됩니다.") && setStatus(o, "cancelled")}>취소</Button>
                  : <Button size="sm" variant="outline" onClick={() => setStatus(o, "pending")}>복구</Button>}
                <Button size="sm" variant="ghost" onClick={() => editMemo(o)}>메모</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">표시할 신청이 없습니다.</p>}
      </div>
    </div>
  );
}

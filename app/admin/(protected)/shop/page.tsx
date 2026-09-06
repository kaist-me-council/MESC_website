"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminGuide } from "@/components/admin-guide";

type Choice = "pickup" | "refund" | "exchange";
interface Item { color: "white" | "black"; size: string; qty: number }
interface Resolution extends Item { choice: Choice; exchangeSize?: string }
interface Row {
  id: number; affiliation: string; name: string; email: string; phone: string | null; hasStudentId: boolean;
  items: Item[]; pickedUp: boolean; memo: string | null; response: "received" | "not_received" | null;
  resolution: Resolution[] | null; responseNote: string | null; respondedAt: string | null;
}
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const col = (c: string) => (c === "white" ? "흰" : "검");
const choiceLabel: Record<Choice, string> = { pickup: "수령", refund: "환불", exchange: "교환" };

export default function AdminShopPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "none" | "received" | "not_received" | "unpicked">("all");
  const [q, setQ] = useState("");
  const [csvText, setCsvText] = useState("");
  const [replace, setReplace] = useState(true);
  const [preview, setPreview] = useState<{ count: number; problems: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  async function load() {
    const res = await fetch("/api/admin/shop/prior", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.rows);
  }
  useEffect(() => { Promise.resolve().then(load); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    received: rows.filter((r) => r.response === "received").length,
    notReceived: rows.filter((r) => r.response === "not_received").length,
    none: rows.filter((r) => !r.response).length,
    unpicked: rows.filter((r) => !r.pickedUp).length,
  }), [rows]);

  // 못 받음 응답의 항목별 집계 (색×사이즈×선택)
  const shortage = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.response === "not_received").forEach((r) =>
      (r.resolution ?? r.items.map((i): Resolution => ({ ...i, choice: "pickup" }))).forEach((x) => {
        const k = `${col(x.color)} ${x.size} · ${choiceLabel[x.choice]}${x.choice === "exchange" ? `→${x.exchangeSize}` : ""}`;
        m.set(k, (m.get(k) ?? 0) + x.qty);
      }));
    return [...m.entries()].sort();
  }, [rows]);

  const visible = rows.filter((r) => {
    if (filter === "none" && r.response) return false;
    if (filter === "received" && r.response !== "received") return false;
    if (filter === "not_received" && r.response !== "not_received") return false;
    if (filter === "unpicked" && r.pickedUp) return false;
    if (q && !`${r.name} ${r.email} ${r.affiliation}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function dryRun() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/admin/shop/prior", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText, dryRun: true }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "미리보기 실패"); return; }
    setPreview({ count: data.count, problems: data.problems });
  }
  async function doImport() {
    if (replace && !confirm(`기존 명단 ${rows.length}건을 지우고 새로 넣습니다. 응답도 초기화됩니다. 계속할까요?`)) return;
    setBusy(true); setMsg("");
    const res = await fetch("/api/admin/shop/prior", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText, replace }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "import 실패"); return; }
    setMsg(`${data.imported}건 적재 완료${data.problems.length ? ` (해석 불가 ${data.problems.length}건은 항목 없이 들어감 — 아래 목록에서 비고 확인)` : ""}`);
    setCsvText(""); setPreview(null); load();
  }
  async function setResponse(r: Row, response: Row["response"]) {
    await fetch("/api/admin/shop/prior", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, response }) });
    load();
  }
  async function copyEmails() {
    const emails = [...new Set(visible.map((r) => r.email.trim().toLowerCase()).filter(Boolean))];
    await navigator.clipboard.writeText(emails.join(", "));
    setCopied(`${emails.length}개 복사됨`);
    setTimeout(() => setCopied(""), 2500);
  }
  async function editNote(r: Row) {
    const v = prompt("관리자 메모", r.responseNote ?? "");
    if (v === null) return;
    await fetch("/api/admin/shop/prior", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, responseNote: v }) });
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">반팔티 구매 확인</h1>
      </div>

      <AdminGuide id="shop" title="반팔티 1차 구매 확인 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>명단 적재</strong>: 구글 시트 「나눠주기」 탭을 CSV로 내려받아(파일 → 다운로드 → CSV) 아래 칸에 붙여넣거나 파일을 선택 → <strong>미리보기</strong>로 해석 결과 확인 → <strong>적재</strong>.</li>
          <li>학번은 서버에서 해시로만 저장되고 원문은 버려집니다. 이 화면에도 학번은 표시되지 않습니다.</li>
          <li>구매자는 <code>/shop/check</code>에서 학번+이름(교수는 이메일+이름)으로 조회해 받음/못 받음을 답합니다. 마감 9/13 23:59.</li>
          <li>전화·카톡으로 받은 회신은 목록의 <strong>받음/못 받음</strong> 버튼으로 대신 기록할 수 있습니다.</li>
          <li><strong>못 받음 집계</strong>가 사이즈별 필요량입니다. CSV 내보내기로 정산·환불 명단을 뽑으세요.</li>
        </ol>
      </AdminGuide>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">명단 적재 (CSV)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input type="file" accept=".csv,text/csv" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsvText(await f.text()); setPreview(null); } }} />
          <textarea className="w-full h-28 rounded-md border bg-background p-2 font-mono text-xs" placeholder="또는 CSV 내용을 여기에 붙여넣기 (첫 줄은 헤더: 구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무 …)" value={csvText} onChange={(e) => { setCsvText(e.target.value); setPreview(null); }} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={replace} onCheckedChange={(v) => setReplace(v === true)} /> 기존 명단 지우고 새로 넣기</label>
            <Button size="sm" variant="outline" disabled={!csvText.trim() || busy} onClick={dryRun}>미리보기</Button>
            <Button size="sm" disabled={!preview || busy} onClick={doImport}>적재</Button>
            {rows.length > 0 && <Button size="sm" variant="outline" className="ml-auto" disabled={visible.length === 0} onClick={copyEmails}>이메일 복사 (현재 필터)</Button>}
            {copied && <span className="text-sm text-muted-foreground">{copied}</span>}
            {rows.length > 0 && <a className="text-sm underline" href="/api/admin/shop/prior?format=csv">CSV 내보내기</a>}
          </div>
          {preview && (
            <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
              <p><strong>{preview.count}명</strong> 해석됨{preview.problems.length ? `, 문제 ${preview.problems.length}건:` : ", 문제 없음"}</p>
              {preview.problems.map((p, i) => <p key={i} className="text-xs text-destructive">{p}</p>)}
            </div>
          )}
          {msg && <p className="text-sm">{msg}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {([["all", "전체", stats.total], ["none", "미응답", stats.none], ["received", "받음", stats.received], ["not_received", "못 받음", stats.notReceived], ["unpicked", "배부기록 미픽업", stats.unpicked]] as const).map(([k, label, n]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md border p-3 text-left ${filter === k ? "ring-2 ring-primary" : ""}`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold">{n}</div>
          </button>
        ))}
      </div>

      {shortage.length > 0 && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">못 받음 집계 (색·사이즈·선택별 벌 수)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {shortage.map(([k, n]) => <Badge key={k} variant="outline" className="text-sm">{k}: <strong className="ml-1">{n}</strong></Badge>)}
          </CardContent>
        </Card>
      )}

      <Input placeholder="이름·이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-xs" />
      <p className="text-sm text-muted-foreground mb-2">{visible.length}건 표시</p>
      <div className="space-y-2">
        {visible.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="secondary" className="text-xs">{r.affiliation}</Badge>
                  {!r.pickedUp && <Badge variant="outline" className="text-xs">배부기록 미픽업</Badge>}
                  {r.response === "received" && <Badge className="text-xs">받음</Badge>}
                  {r.response === "not_received" && <Badge variant="destructive" className="text-xs">못 받음</Badge>}
                  {!r.hasStudentId && <Badge variant="outline" className="text-xs">학번 없음</Badge>}
                </div>
                <div className="text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                <div>{r.items.map((i) => `${col(i.color)} ${i.size}×${i.qty}`).join(", ") || <span className="text-destructive">항목 없음</span>}</div>
                {r.resolution && <div className="text-xs">처리: {r.resolution.map((x) => `${col(x.color)} ${x.size}×${x.qty} ${choiceLabel[x.choice]}${x.choice === "exchange" ? `→${x.exchangeSize}` : ""}`).join(", ")}</div>}
                {r.memo && <div className="text-xs text-muted-foreground">비고: {r.memo}</div>}
                {r.responseNote && <div className="text-xs">메모: {r.responseNote}</div>}
                {r.respondedAt && <div className="text-xs text-muted-foreground">{new Date(r.respondedAt).toLocaleString("ko-KR")}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant={r.response === "received" ? "default" : "outline"} onClick={() => setResponse(r, r.response === "received" ? null : "received")}>받음</Button>
                <Button size="sm" variant={r.response === "not_received" ? "destructive" : "outline"} onClick={() => setResponse(r, r.response === "not_received" ? null : "not_received")}>못 받음</Button>
                <Button size="sm" variant="ghost" onClick={() => editNote(r)}>메모</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">사이즈 표기: {SIZES.join(" · ")}. 폼의 XL(LL)→XL, 2XL(3L)→2XL 로 통일되어 있습니다.</p>
    </div>
  );
}

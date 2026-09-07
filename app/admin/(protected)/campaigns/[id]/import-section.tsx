"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface Preview { count: number; problems: string[]; newOptions?: { group: string | null; name: string }[]; willDelete?: { orders: number; confirmed: number } }

export function ImportSection({ campaignId, importCount, onDone }: { campaignId: number; importCount: number; onDone: () => Promise<void> }) {
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<"tshirt" | "generic">("tshirt");
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmRun, setConfirmRun] = useState(false);
  // 미리보기가 깨끗할 때만 적재 (서버도 같은 조건으로 거부한다)
  const canRun = !!preview && preview.problems.length === 0 && preview.count > 0 && !busy;

  async function post(body: object) {
    const res = await fetch(`/api/admin/campaigns/${campaignId}/orders/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }
  async function dryRun() {
    setBusy(true); setMsg(""); setConfirmRun(false);
    const { ok, data } = await post({ csv, mode, dryRun: true });
    setBusy(false);
    if (!ok) { setMsg(data.error ?? "미리보기 실패"); return; }
    setPreview({ count: data.count, problems: data.problems ?? [], newOptions: data.newOptions ?? [], willDelete: data.willDelete });
  }
  async function run() {
    if (!canRun) return;
    setBusy(true); setMsg(""); setConfirmRun(false);
    const { ok, data } = await post({ csv, mode, replace });
    setBusy(false);
    if (!ok) { setMsg(data.error ?? "적재 실패"); return; }
    setMsg(`${data.imported}건 적재 완료${data.problems?.length ? ` (문제 ${data.problems.length}건은 항목 없이 들어감)` : ""}${data.createdOptions ? `, 옵션 ${data.createdOptions}개 생성` : ""}`);
    setCsv(""); setPreview(null); await onDone();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">주문 적재 (CSV)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "tshirt"} onChange={() => setMode("tshirt")} /> 배부 시트 (구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무)</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "generic"} onChange={() => setMode("generic")} /> 일반 CSV (구분,이름,학번,전화,이메일,항목,상태)</label>
        </div>
        <input type="file" accept=".csv,text/csv" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setPreview(null); } e.target.value = ""; }} />
        <textarea className="w-full h-24 rounded-md border bg-background p-2 font-mono text-xs" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
          placeholder={mode === "tshirt" ? "구글 시트 「나눠주기」 탭을 CSV로 내려받아 붙여넣기" : "항목 예: 흰색 XL×1; 검정 L×2 — 상태: 대기|입금|수령|취소 (빈칸=입금)"} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={replace} onCheckedChange={(v) => setReplace(v === true)} /> 이전에 적재한 주문({importCount}건)을 지우고 새로 넣기 (웹 신청은 보존)</label>
          <Button size="sm" variant="outline" disabled={!csv.trim() || busy} onClick={dryRun}>미리보기</Button>
          {confirmRun
            ? <><Button size="sm" disabled={!canRun} onClick={run}>정말 적재</Button><Button size="sm" variant="ghost" onClick={() => setConfirmRun(false)}>아니오</Button></>
            : <Button size="sm" disabled={!canRun} onClick={() => setConfirmRun(true)}>적재</Button>}
        </div>
        {preview && (
          <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
            <p><strong>{preview.count}건</strong> 해석됨{preview.problems.length ? `, 문제 ${preview.problems.length}건:` : ", 문제 없음"}</p>
            {replace && preview.willDelete && preview.willDelete.orders > 0 && (
              <p className="text-xs font-medium text-destructive">⚠ 적재하면 이전 적재 주문 {preview.willDelete.orders}건이 지워집니다{preview.willDelete.confirmed > 0 ? ` — 그중 수령 확인 응답이 있는 ${preview.willDelete.confirmed}건도 함께 사라집니다` : ""}.</p>
            )}
            {preview.problems.length > 0 && <p className="text-xs font-medium text-destructive">문제 행이 있어 적재할 수 없습니다. CSV 를 고친 뒤 다시 미리보기 하세요.</p>}
            {preview.count === 0 && <p className="text-xs font-medium text-destructive">해석된 행이 없어 적재할 수 없습니다.</p>}
            {preview.problems.map((p, i) => <p key={i} className="text-xs text-destructive">{p}</p>)}
            {preview.newOptions && preview.newOptions.length > 0 && (
              <p className="text-xs">새로 생길 옵션: {preview.newOptions.map((o) => `${o.group ? o.group + " " : ""}${o.name}`).join(", ")}</p>
            )}
          </div>
        )}
        {msg && <p className="text-sm">{msg}</p>}
        <p className="text-xs text-muted-foreground">학번은 서버에서 해시로만 저장되고 원문은 버려집니다. 적재 후 원본 CSV 파일은 지우세요.</p>
      </CardContent>
    </Card>
  );
}

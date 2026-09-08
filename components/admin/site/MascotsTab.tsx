"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ImageUp } from "lucide-react";
import type { MascotRow } from "@/components/admin/SiteSettingsEditor";

/** 학부 소개 > 마스코트 탭에 노출되는 캐릭터를 관리한다. 사진은 업로드해서 붙인다. */
export default function MascotsTab({ initial }: { initial: MascotRow[] }) {
  const [rows, setRows] = useState<MascotRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const patch = (id: number, p: Partial<MascotRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function add() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/mascots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "새 마스코트", descKo: "소개를 입력하세요", order: rows.length, enabled: false }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      const created: MascotRow = await res.json();
      setRows((rs) => [...rs, created]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function saveOne(m: MascotRow) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/mascots/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      setMsg(`'${m.name}' 저장했습니다.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    setBusy(true); setMsg(null); setConfirmDel(null);
    try {
      const res = await fetch(`/api/mascots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "삭제 실패");
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function upload(id: number, file: File) {
    setUploadingId(id); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      patch(id, { imageUrl: data.url });
      setMsg("이미지를 올렸습니다. '저장'을 눌러야 반영됩니다.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setUploadingId(null); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
        <p className="font-medium">학부 소개 페이지의 <strong>마스코트</strong> 탭에 표시됩니다.</p>
        <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
          <li>사진은 <strong>투명 배경 PNG</strong>가 가장 예쁘게 나옵니다. 4MB 이하.</li>
          <li><strong>공개</strong>를 끄면 학생에게는 보이지 않고 관리자에게만 보입니다. 준비되면 켜세요.</li>
          <li>영문 칸을 비우면 영어 모드에서도 한국어가 그대로 나옵니다.</li>
        </ul>
      </div>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">등록된 마스코트가 없습니다. 아래 버튼으로 추가하세요.</p>}

      {rows.map((m) => (
        <Card key={m.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {m.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={m.imageUrl} alt="" className="h-20 w-20 rounded-lg border object-contain bg-muted/40" />
                : <div className="h-20 w-20 rounded-lg border grid place-items-center text-muted-foreground bg-muted/40"><ImageUp className="h-6 w-6" /></div>}
              <div className="space-y-1">
                <input
                  type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm"
                  disabled={uploadingId === m.id}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(m.id, f); e.target.value = ""; }}
                />
                {uploadingId === m.id && <p className="text-xs text-muted-foreground">업로드 중...</p>}
                {m.imageUrl && <Button size="sm" variant="ghost" onClick={() => patch(m.id, { imageUrl: null })}>이미지 제거</Button>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>이름</Label><Input value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} /></div>
              <div className="space-y-1"><Label>이름 (EN)</Label><Input value={m.nameEn ?? ""} onChange={(e) => patch(m.id, { nameEn: e.target.value })} /></div>
              <div className="space-y-1"><Label>한 줄 소개</Label><Input value={m.tagKo ?? ""} onChange={(e) => patch(m.id, { tagKo: e.target.value })} placeholder="예: 기계과를 지키는 톱니 요정" /></div>
              <div className="space-y-1"><Label>한 줄 소개 (EN)</Label><Input value={m.tagEn ?? ""} onChange={(e) => patch(m.id, { tagEn: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>소개</Label><Textarea rows={4} value={m.descKo} onChange={(e) => patch(m.id, { descKo: e.target.value })} placeholder="언제 어떻게 만들어졌는지, 이름의 뜻, 어디에 쓰이는지" /></div>
              <div className="space-y-1 sm:col-span-2"><Label>소개 (EN)</Label><Textarea rows={3} value={m.descEn ?? ""} onChange={(e) => patch(m.id, { descEn: e.target.value })} /></div>
              <div className="space-y-1"><Label>표시 순서</Label><Input type="number" value={m.order} onChange={(e) => patch(m.id, { order: Number(e.target.value) || 0 })} /></div>
              <label className="flex items-center gap-2 text-sm pt-6">
                <Checkbox checked={m.enabled} onCheckedChange={(v) => patch(m.id, { enabled: v === true })} /> 공개
              </label>
            </div>

            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => saveOne(m)}>저장</Button>
              {confirmDel === m.id
                ? <><Button size="sm" variant="destructive" disabled={busy} onClick={() => remove(m.id)}>정말 삭제</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDel(null)}>아니오</Button></>
                : <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDel(m.id)}><Trash2 className="h-4 w-4 mr-1" />삭제</Button>}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" disabled={busy} onClick={add}><Plus className="h-4 w-4 mr-1" />마스코트 추가</Button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

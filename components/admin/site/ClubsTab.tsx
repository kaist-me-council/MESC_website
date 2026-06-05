"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { CLUB_COLOR_PRESETS } from "@/lib/site-settings";
import type { ClubRow } from "@/components/admin/SiteSettingsEditor";

const COLOR_KEYS = Object.keys(CLUB_COLOR_PRESETS);

export default function ClubsTab({ initial }: { initial: ClubRow[] }) {
  const [clubs, setClubs] = useState<ClubRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch(id: number, p: Partial<ClubRow>) {
    setClubs((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function add() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "새 동아리", descKo: "설명을 입력하세요", colorPreset: "blue", order: clubs.length }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      const created: ClubRow = await res.json();
      setClubs((cs) => [...cs, created]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function saveOne(c: ClubRow) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/clubs/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      setMsg("저장됨");
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("이 동아리를 삭제할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clubs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setClubs((cs) => cs.filter((c) => c.id !== id));
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={add} disabled={busy}><Plus className="h-4 w-4 mr-1" /> 동아리 추가</Button>
      </div>
      {clubs.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>이름 (KO)</Label><Input value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} /></div>
              <div className="grid gap-1"><Label>이름 (EN)</Label><Input value={c.nameEn ?? ""} onChange={(e) => patch(c.id, { nameEn: e.target.value })} /></div>
              <div className="grid gap-1"><Label>태그 (KO)</Label><Input value={c.tagKo ?? ""} onChange={(e) => patch(c.id, { tagKo: e.target.value })} /></div>
              <div className="grid gap-1"><Label>태그 (EN)</Label><Input value={c.tagEn ?? ""} onChange={(e) => patch(c.id, { tagEn: e.target.value })} /></div>
            </div>
            <div className="grid gap-1"><Label>설명 (KO)</Label><Textarea rows={3} value={c.descKo} onChange={(e) => patch(c.id, { descKo: e.target.value })} /></div>
            <div className="grid gap-1"><Label>설명 (EN)</Label><Textarea rows={3} value={c.descEn ?? ""} onChange={(e) => patch(c.id, { descEn: e.target.value })} /></div>
            <div className="grid gap-1"><Label>활동 (KO, 한 줄에 하나)</Label><Textarea rows={4} value={c.activitiesKo ?? ""} onChange={(e) => patch(c.id, { activitiesKo: e.target.value })} /></div>
            <div className="grid gap-1"><Label>활동 (EN, 한 줄에 하나)</Label><Textarea rows={4} value={c.activitiesEn ?? ""} onChange={(e) => patch(c.id, { activitiesEn: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>링크 URL</Label><Input value={c.url ?? ""} onChange={(e) => patch(c.id, { url: e.target.value })} /></div>
              <div className="grid gap-1"><Label>링크 라벨</Label><Input value={c.urlLabel ?? ""} onChange={(e) => patch(c.id, { urlLabel: e.target.value })} placeholder="site / insta" /></div>
              <div className="grid gap-1"><Label>이모지</Label><Input value={c.emoji ?? ""} onChange={(e) => patch(c.id, { emoji: e.target.value })} placeholder="🤖" /></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid gap-1"><Label>색상</Label>
                <select className="border border-border rounded-md h-9 px-2 bg-background text-sm" value={c.colorPreset ?? "blue"} onChange={(e) => patch(c.id, { colorPreset: e.target.value })}>
                  {COLOR_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="grid gap-1 w-20"><Label>순서</Label><Input type="number" value={c.order} onChange={(e) => patch(c.id, { order: Number(e.target.value) })} /></div>
              <label className="flex items-center gap-1 text-sm mt-5"><input type="checkbox" checked={c.enabled} onChange={(e) => patch(c.id, { enabled: e.target.checked })} /> 노출</label>
              <div className="ml-auto flex gap-2 mt-5">
                <Button size="sm" onClick={() => saveOne(c)} disabled={busy}>저장</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}

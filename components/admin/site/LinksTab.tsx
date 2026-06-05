"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import type { SiteLinkRow } from "@/components/admin/SiteSettingsEditor";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "important", label: "주요 링크" },
  { key: "community", label: "SNS·커뮤니티" },
];

export default function LinksTab({ initial }: { initial: SiteLinkRow[] }) {
  const [links, setLinks] = useState<SiteLinkRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch(id: number, p: Partial<SiteLinkRow>) {
    setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }

  async function add(category: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/site-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, label: "새 링크", url: "https://", order: links.filter((l) => l.category === category).length }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "추가 실패");
      const created: SiteLinkRow = await res.json();
      setLinks((ls) => [...ls, created]);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function saveOne(l: SiteLinkRow) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/site-links/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(l),
      });
      if (!res.ok) throw new Error((await res.json()).error || "저장 실패");
      setMsg("저장됨");
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("이 링크를 삭제할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/site-links/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setLinks((ls) => ls.filter((l) => l.id !== id));
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black">{cat.label}</h3>
            <Button size="sm" variant="outline" onClick={() => add(cat.key)} disabled={busy}>
              <Plus className="h-4 w-4 mr-1" /> 추가
            </Button>
          </div>
          {links.filter((l) => l.category === cat.key).map((l) => (
            <Card key={l.id}>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>라벨 (KO)</Label><Input value={l.label} onChange={(e) => patch(l.id, { label: e.target.value })} /></div>
                  <div className="grid gap-1"><Label>라벨 (EN)</Label><Input value={l.labelEn ?? ""} onChange={(e) => patch(l.id, { labelEn: e.target.value })} /></div>
                </div>
                <div className="grid gap-1"><Label>URL</Label><Input value={l.url} onChange={(e) => patch(l.id, { url: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>설명 (KO)</Label><Input value={l.description ?? ""} onChange={(e) => patch(l.id, { description: e.target.value })} /></div>
                  <div className="grid gap-1"><Label>설명 (EN)</Label><Input value={l.descriptionEn ?? ""} onChange={(e) => patch(l.id, { descriptionEn: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid gap-1 w-24"><Label>아이콘</Label><Input value={l.icon ?? ""} onChange={(e) => patch(l.id, { icon: e.target.value })} placeholder="🔗" /></div>
                  <div className="grid gap-1 w-24"><Label>순서</Label><Input type="number" value={l.order} onChange={(e) => patch(l.id, { order: Number(e.target.value) })} /></div>
                  <label className="flex items-center gap-1 text-sm mt-5"><input type="checkbox" checked={l.enabled} onChange={(e) => patch(l.id, { enabled: e.target.checked })} /> 노출</label>
                  <div className="ml-auto flex gap-2 mt-5">
                    <Button size="sm" onClick={() => saveOne(l)} disabled={busy}>저장</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id)} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}

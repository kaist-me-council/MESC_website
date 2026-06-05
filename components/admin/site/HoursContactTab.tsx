"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { WEEKDAY_LABELS, type OperatingHours } from "@/lib/site-settings";
import type { SiteSettingsData } from "@/components/admin/SiteSettingsEditor";

export default function HoursContactTab({ initial }: { initial: SiteSettingsData }) {
  const [locationKo, setLocationKo] = useState(initial.locationKo);
  const [locationEn, setLocationEn] = useState(initial.locationEn);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [hours, setHours] = useState<OperatingHours>(initial.hours);
  const [lunchEnabled, setLunchEnabled] = useState(initial.hours.lunch !== null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function setDay(idx: number, patch: Partial<OperatingHours["days"][number]>) {
    setHours((h) => ({ ...h, days: h.days.map((d, i) => (i === idx ? { ...d, ...patch } : d)) }));
  }
  function setLunch(patch: Partial<NonNullable<OperatingHours["lunch"]>>) {
    setHours((h) => ({ ...h, lunch: { ...(h.lunch ?? { open: "12:00", close: "13:00" }), ...patch } }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        locationKo, locationEn, email, phone,
        hours: { ...hours, lunch: lunchEnabled ? (hours.lunch ?? { open: "12:00", close: "13:00" }) : null },
      };
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "저장 실패");
      }
      setMsg("저장되었습니다.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">연락처·위치</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2"><Label>위치 (한국어)</Label><Input value={locationKo} onChange={(e) => setLocationKo(e.target.value)} /></div>
          <div className="grid gap-2"><Label>위치 (English)</Label><Input value={locationEn} onChange={(e) => setLocationEn(e.target.value)} /></div>
          <div className="grid gap-2"><Label>이메일</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid gap-2"><Label>전화번호 (선택)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">운영시간</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {hours.days.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-8 font-bold">{WEEKDAY_LABELS.ko[i]}</span>
              <label className="flex items-center gap-1 text-sm">
                <Checkbox checked={d.closed} onCheckedChange={(c) => setDay(i, { closed: Boolean(c) })} />
                휴무
              </label>
              <Input type="time" value={d.open} disabled={d.closed} onChange={(e) => setDay(i, { open: e.target.value })} className="w-32" />
              <span>~</span>
              <Input type="time" value={d.close} disabled={d.closed} onChange={(e) => setDay(i, { close: e.target.value })} className="w-32" />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-border/40">
            <label className="flex items-center gap-1 text-sm w-20">
              <Checkbox checked={lunchEnabled} onCheckedChange={(c) => setLunchEnabled(Boolean(c))} />
              점심시간
            </label>
            <Input type="time" value={hours.lunch?.open ?? "12:00"} disabled={!lunchEnabled} onChange={(e) => setLunch({ open: e.target.value })} className="w-32" />
            <span>~</span>
            <Input type="time" value={hours.lunch?.close ?? "13:00"} disabled={!lunchEnabled} onChange={(e) => setLunch({ close: e.target.value })} className="w-32" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

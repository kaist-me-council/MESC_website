"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toIso, toLocal } from "../types";
import type { SectionProps } from "./shared";
export function ScheduleSection({ c, set }: SectionProps) { return <div className="grid gap-4 sm:grid-cols-2">
  <div className="space-y-1"><Label>신청 시작</Label><Input className="h-11 rounded-xl" type="datetime-local" value={toLocal(c.opensAt)} onChange={(e) => set("opensAt", toIso(e.target.value))} /></div>
  <div className="space-y-1"><Label>신청 마감</Label><Input className="h-11 rounded-xl" type="datetime-local" value={toLocal(c.closesAt)} onChange={(e) => set("closesAt", toIso(e.target.value))} /></div>
  <div className="space-y-1"><Label>행사 일시</Label><Input className="h-11 rounded-xl" type="datetime-local" value={toLocal(c.eventAt ?? null)} onChange={(e) => set("eventAt", toIso(e.target.value))} /></div>
  <div className="space-y-1"><Label>행사 장소</Label><Input className="h-11 rounded-xl" value={c.eventPlace ?? ""} onChange={(e) => set("eventPlace", e.target.value || null)} /></div>
  <a className="text-sm underline text-muted-foreground sm:col-span-2" href={`/apply/${c.slug}`} target="_blank" rel="noreferrer">학생 화면 미리보기</a>
</div>; }

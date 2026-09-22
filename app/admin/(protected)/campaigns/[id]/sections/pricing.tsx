"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SectionProps } from "./shared";
import { Toggle } from "./shared";
export function PricingSection({ c, set }: SectionProps) { return <div className="space-y-5">
  <Toggle checked={!!c.requiresPayment} onChange={(v) => set("requiresPayment", v)} label="유료 행사" help="입금 확인 후 신청을 받습니다." />
  {c.requiresPayment && <div className="grid animate-in gap-4 rounded-2xl bg-muted/30 p-4 fade-in slide-in-from-top-1 duration-150 sm:grid-cols-2"><div className="space-y-1"><Label>은행</Label><Input className="h-11 rounded-xl" value={c.bankName ?? ""} onChange={(e) => set("bankName", e.target.value || null)} placeholder="예: 신한은행" /></div><div className="space-y-1"><Label>계좌번호</Label><Input className="h-11 rounded-xl tabular-nums" inputMode="numeric" value={c.accountNumber ?? ""} onChange={(e) => set("accountNumber", e.target.value || null)} placeholder="예: 110-123-456789" /></div><p className="text-xs text-muted-foreground sm:col-span-2">학생 화면의 복사 버튼은 계좌번호만 복사합니다.</p><div className="space-y-1 sm:col-span-2"><Label>완료 안내</Label><Textarea value={c.afterNote ?? ""} onChange={(e) => set("afterNote", e.target.value || null)} /></div><div className="space-y-1 sm:col-span-2"><Label>완료 안내 (EN)</Label><Textarea value={c.afterNoteEn ?? ""} onChange={(e) => set("afterNoteEn", e.target.value || null)} /></div></div>}
  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label>1인 최대 수량</Label><Input className="h-11 rounded-xl" type="number" min={1} value={c.maxPerPerson ?? ""} onChange={(e) => set("maxPerPerson", e.target.value ? Number(e.target.value) : null)} /></div><div className="flex items-end pb-2"><Toggle checked={c.showRemaining !== false} onChange={(v) => set("showRemaining", v)} label="남은 자리 공개" help={c.showRemaining === false ? "학생에게는 품절 여부만 보입니다." : undefined} /></div></div>
</div>; }

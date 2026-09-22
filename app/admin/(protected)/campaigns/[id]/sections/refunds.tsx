"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readRefundPolicy, toIso, toLocal, type RefundTier } from "../types";
import type { SectionProps } from "./shared";

export function RefundsSection({ c, set, setC }: SectionProps) {
  const tiers = readRefundPolicy(c);
  const update = (next: RefundTier[]) => setC((prev) => ({ ...prev, refundPolicy: next }));
  const patch = (index: number, value: Partial<RefundTier>) => update(tiers.map((tier, i) => i === index ? { ...tier, ...value } : tier));
  const add = () => update([...tiers, { deadline: c.cancelDeadline ?? c.eventAt ?? c.closesAt ?? new Date().toISOString(), refundPercent: 100, note: null, noteEn: null }]);

  return <div className="space-y-5">
    <div className="space-y-1">
      <Label>취소 접수 마감</Label>
      <Input className="h-11 max-w-md rounded-xl" type="datetime-local" value={toLocal(c.cancelDeadline ?? null)} onChange={(e) => set("cancelDeadline", toIso(e.target.value))} />
      <p className="text-xs text-muted-foreground">이 시각까지 ‘내 신청 확인’에서 직접 취소할 수 있습니다. 비우면 기존처럼 입금 대기 상태인 동안 취소할 수 있습니다.</p>
    </div>

    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">단계별 환불 기준</h3>
        <p className="text-xs text-muted-foreground">각 시각까지 학생회에 취소를 접수했을 때의 환불률입니다. 마지막 단계가 지나면 ‘환불 불가’로 안내됩니다.</p>
      </div>
      {tiers.map((tier, index) => <div key={`${tier.deadline}-${index}`} className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[1.3fr_100px_1fr_40px]">
        <div className="space-y-1"><Label>접수 기한</Label><Input type="datetime-local" value={toLocal(tier.deadline)} onChange={(e) => patch(index, { deadline: toIso(e.target.value) ?? "" })} /></div>
        <div className="space-y-1"><Label>환불률 (%)</Label><Input type="number" min={0} max={100} step={1} value={tier.refundPercent} onChange={(e) => patch(index, { refundPercent: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label>조건·설명 (선택)</Label><Input value={tier.note ?? ""} onChange={(e) => patch(index, { note: e.target.value || null })} placeholder="예: 제작 착수 전" /></div>
        <Button className="self-end" variant="ghost" size="icon" aria-label="환불 기준 삭제" onClick={() => update(tiers.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
        <div className="space-y-1 sm:col-span-3"><Label>조건·설명 (EN, 선택)</Label><Input value={tier.noteEn ?? ""} onChange={(e) => patch(index, { noteEn: e.target.value || null })} /></div>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ 환불 단계 추가</Button>
    </div>

    <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">이 설정은 이벤트별 운영 기준입니다. 법정 청약철회·하자 환불 등 관계 법령상 권리는 별도로 우선합니다.</p>
  </div>;
}

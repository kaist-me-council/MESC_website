"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Option } from "../types";
import type { SectionProps } from "./shared";
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
export function OptionsSection({ c, setC }: SectionProps) {
  const [bulk, setBulk] = useState("");
  const setOpt = (i: number, value: Partial<Option>) => setC((prev) => ({ ...prev, options: prev.options.map((o, j) => i === j ? { ...o, ...value } : o) }));
  const addBulk = (text: string) => { setC((prev) => { const start = prev.options.length; const added: Option[] = text.split(/\r?\n/).map((v) => v.trim()).filter(Boolean).map((line, i) => { const [group = "", name = "", price = "0", stock = ""] = line.split(",").map((v) => v.trim()); return { group, name, nameEn: "", price: Number(price) || 0, stock: stock === "" ? null : Number(stock), order: start + i, enabled: true }; }).filter((o) => o.name); return { ...prev, options: [...prev.options, ...added] }; }); setBulk(""); };
  const preset = () => addBulk(["흰색", "검정"].flatMap((g) => SIZES.map((s) => `${g},${s},${["2XL", "3XL", "4XL"].includes(s) ? 9500 : 8000},`)).join("\n"));
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">굿즈는 그룹=색상, 이름=사이즈로 입력하세요.</p>
    {c.options.map((o, i) => <div key={o.id ?? `new-${i}`} className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_90px_80px_60px_45px_40px]">
      <Input value={o.group} onChange={(e) => setOpt(i, { group: e.target.value })} placeholder="그룹" /><Input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} placeholder="이름" /><Input value={o.nameEn} onChange={(e) => setOpt(i, { nameEn: e.target.value })} placeholder="EN" /><Input type="number" value={o.price} onChange={(e) => setOpt(i, { price: Number(e.target.value) || 0 })} /><Input type="number" value={o.stock ?? ""} onChange={(e) => setOpt(i, { stock: e.target.value === "" ? null : Number(e.target.value) })} placeholder="∞" /><Input type="number" value={o.order} onChange={(e) => setOpt(i, { order: Number(e.target.value) || 0 })} /><Checkbox checked={o.enabled} onCheckedChange={(v) => setOpt(i, { enabled: v === true })} /><Button variant="ghost" size="sm" onClick={() => setC((prev) => ({ ...prev, options: prev.options.filter((_, j) => i !== j) }))}><X className="h-4 w-4" /></Button>
    </div>)}
    <div className="space-y-2 rounded-2xl bg-muted/40 p-4"><Label>옵션 일괄 추가 — 그룹,이름,가격,재고</Label><Textarea className="font-mono text-xs" value={bulk} onChange={(e) => setBulk(e.target.value)} /><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!bulk.trim()} onClick={() => addBulk(bulk)}>추가</Button>{c.kind === "goods" && <Button variant="outline" size="sm" onClick={preset}>반팔티 14옵션 채우기</Button>}</div></div>
  </div>;
}

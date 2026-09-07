"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import type { Campaign, Option, T } from "./types";
import { fill } from "./types";

/**
 * 굿즈(옷 등) 상품형 선택: 색상 칩 → 사이즈 칩 → 수량 → 담기.
 * 선택 상태는 부모의 qty(optionId → 수량)에 누적된다.
 */
export function GoodsPicker({ campaign, qty, setQty, unit, optName, won, t }: {
  campaign: Campaign;
  qty: Record<number, number>;
  setQty: (q: Record<number, number>) => void;
  unit: (o: Option) => number;
  optName: (o: Option) => string;
  won: (n: number) => string;
  t: T;
}) {
  const groups = [...new Set(campaign.options.map((o) => o.group ?? ""))];
  const [group, setGroup] = useState(groups[0] ?? "");
  const [optId, setOptId] = useState<number | null>(null);
  const [n, setN] = useState(1);

  const sizes = campaign.options.filter((o) => (o.group ?? "") === group);
  const picked = campaign.options.find((o) => o.id === optId) ?? null;
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);
  const cap = (o: Option) => {
    const stock = o.remaining === null ? Infinity : o.remaining - (qty[o.id] ?? 0);
    const person = campaign.maxPerPerson ? campaign.maxPerPerson - totalQty : Infinity;
    return Math.max(0, Math.min(stock, person, campaign.allowQty ? Infinity : 1));
  };
  const disabled = !campaign.open;
  const out = (o: Option) => o.remaining !== null && o.remaining - (qty[o.id] ?? 0) <= 0;

  function add() {
    if (!picked) return;
    const v = Math.min(n, cap(picked));
    if (v <= 0) return;
    setQty({ ...qty, [picked.id]: (qty[picked.id] ?? 0) + v });
    setN(1);
    setOptId(null);
  }

  const chip = (active: boolean, dead: boolean) =>
    `min-h-11 min-w-11 px-4 rounded-xl border text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-150 active:scale-[0.96] ` +
    (active
      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
      : dead
        ? "text-muted-foreground/60 line-through border-border/60 cursor-not-allowed"
        : "bg-background border-border/60 hover:border-primary/60 hover:bg-primary/5");

  const selectedList = campaign.options.filter((o) => (qty[o.id] ?? 0) > 0);

  return (
    <div className="space-y-5">
      {groups.length > 1 || groups[0] ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("apply.color")}</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button key={g} type="button" disabled={disabled} className={chip(group === g, false)} onClick={() => { setGroup(g); setOptId(null); }}>{g || "-"}</button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("apply.size")}</p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((o) => (
            <button key={o.id} type="button" disabled={disabled || out(o)} className={chip(optId === o.id, out(o))} onClick={() => setOptId(o.id)} title={out(o) ? t("apply.soldOut") : undefined}>
              {optName(o)}
              {o.remaining !== null && !out(o) && <span className="ml-1 text-[11px] opacity-70 tabular-nums">{o.remaining - (qty[o.id] ?? 0)}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
        <div className="min-w-0 text-sm">
          {picked ? (
            <>
              <p className="font-medium truncate">{picked.group ? `${picked.group} · ` : ""}{optName(picked)}</p>
              <p className="text-muted-foreground tabular-nums">{unit(picked) === 0 ? t("apply.free") : won(unit(picked))}</p>
            </>
          ) : (
            <p className="text-muted-foreground">{t("apply.pickHint")}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {campaign.allowQty && (
            <div className="flex items-center gap-1">
              <Button type="button" size="icon-lg" variant="outline" className="h-11 w-11 rounded-xl" disabled={!picked || n <= 1} onClick={() => setN(n - 1)} aria-label="-"><Minus className="h-4 w-4" /></Button>
              <span className="w-7 text-center font-semibold tabular-nums">{n}</span>
              <Button type="button" size="icon-lg" variant="outline" className="h-11 w-11 rounded-xl" disabled={!picked || n >= cap(picked)} onClick={() => setN(n + 1)} aria-label="+"><Plus className="h-4 w-4" /></Button>
            </div>
          )}
          <Button type="button" className="h-11 rounded-xl px-4" disabled={!picked || cap(picked) <= 0} onClick={add}>
            <ShoppingBag className="h-4 w-4" />{t("apply.addToList")}
          </Button>
        </div>
      </div>

      {selectedList.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("apply.selected")}</p>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
            {selectedList.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
                <span className="flex-1 min-w-0 truncate">{o.group ? `${o.group} · ` : ""}<strong>{optName(o)}</strong></span>
                <span className="tabular-nums text-muted-foreground">× {qty[o.id]}</span>
                <span className="tabular-nums w-20 text-right">{won(unit(o) * qty[o.id])}</span>
                <button type="button" aria-label={t("apply.remove")} className="h-9 w-9 -mr-1 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" onClick={() => { const q = { ...qty }; delete q[o.id]; setQty(q); }}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {campaign.maxPerPerson && <p className="text-xs text-muted-foreground">{fill(t("apply.maxPerPerson"), campaign.maxPerPerson)}</p>}
        </div>
      )}
    </div>
  );
}

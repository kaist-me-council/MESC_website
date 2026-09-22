"use client";

import type { Campaign } from "../types";

export type SectionProps = {
  c: Campaign;
  set: <K extends keyof Campaign>(key: K, value: Campaign[K]) => void;
  setC: (update: (prev: Campaign) => Campaign) => void;
};

export function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (value: boolean) => void; label: string; help?: string }) {
  return (
    <div className="flex min-h-10 items-center gap-3 text-sm">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="relative h-10 w-11 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className={`absolute inset-x-0 top-2 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`} />
        <span className={`absolute left-0.5 top-2.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
      <span><span className="font-medium">{label}</span>{help && <span className="ml-2 text-xs text-muted-foreground">{help}</span>}</span>
    </div>
  );
}

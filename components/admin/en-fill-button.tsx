"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translateKo } from "@/lib/translate-client";

type Pair = [ko: string, en: string, setEn: (v: string) => void];

/** 비어 있는 영문 칸만 한국어에서 번역해 채운다. 이미 적은 영문은 건드리지 않는다. */
export function EnFillButton({ pairs }: { pairs: Pair[] }) {
  const [busy, setBusy] = useState(false);
  const todo = pairs.filter(([ko, en]) => ko.trim() && !en.trim());
  async function run() {
    setBusy(true);
    try {
      await Promise.all(todo.map(async ([ko, , setEn]) => setEn(await translateKo(ko))));
    } catch (e) {
      alert(e instanceof Error ? e.message : "자동 번역에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={busy || !todo.length} onClick={() => void run()} title="비어 있는 영문 칸을 한국어에서 자동 번역합니다">
      {busy ? "번역 중..." : "🌐 EN 자동 채우기"}
    </Button>
  );
}

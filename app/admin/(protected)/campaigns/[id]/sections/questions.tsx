"use client";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { readQuestions, type Question } from "../types";
import type { SectionProps } from "./shared";
const LABELS: Record<Question["type"], string> = { text: "단답 입력", radio: "단일 선택", checkbox: "복수 선택", consent: "동의·확인" };
function newQuestionId(questions: Question[]) {
  const base = `q${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  let id = base; let suffix = 2;
  while (questions.some((q) => q.id === id)) id = `${base}-${suffix++}`;
  return id;
}
export function QuestionsSection({ c, setC }: SectionProps) {
  const questions = useMemo(() => readQuestions(c), [c]);
  const update = (next: Question[]) => setC((prev) => ({ ...prev, questions: next }));
  const patch = (i: number, value: Partial<Question>) => update(questions.map((q, j) => j === i ? { ...q, ...value } : q));
  const add = (type: Question["type"]) => update([...questions, { id: newQuestionId(questions), type, label: "", required: false, ...((type === "radio" || type === "checkbox") ? { options: [""] } : {}) }]);
  const move = (i: number, d: number) => { const next = [...questions]; const [q] = next.splice(i, 1); next.splice(i + d, 0, q); update(next); };
  const duplicate = (i: number) => { const source = questions[i]; const copy = { ...source, id: newQuestionId(questions), options: source.options ? [...source.options] : undefined }; update([...questions.slice(0, i + 1), copy, ...questions.slice(i + 1)]); };
  return <div className="space-y-4">
    {!questions.length && <p className="text-sm text-muted-foreground">문항이 없습니다. 답변은 신청 목록과 CSV에 문항별 칸으로 들어갑니다.</p>}
    {questions.map((q, i) => <div key={q.id} className="space-y-3 rounded-2xl border border-border/60 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded bg-muted px-2 py-1">{LABELS[q.type]}</span><code>{q.id}</code><div className="ml-auto flex"><button disabled={i === 0} onClick={() => move(i, -1)} aria-label="위로"><ChevronLeft className="h-4 w-4 rotate-90" /></button><button disabled={i === questions.length - 1} onClick={() => move(i, 1)} aria-label="아래로"><ChevronRight className="h-4 w-4 rotate-90" /></button><button onClick={() => duplicate(i)} aria-label="복제"><Copy className="h-4 w-4" /></button><button className="text-destructive" onClick={() => update(questions.filter((_, j) => i !== j))} aria-label="삭제"><X className="h-4 w-4" /></button></div></div>
      <div className="space-y-1"><Label>질문</Label><Textarea value={q.label} onChange={(e) => patch(i, { label: e.target.value })} /></div><div className="space-y-1"><Label>질문 (EN)</Label><Input className="h-11 rounded-xl" value={q.labelEn ?? ""} onChange={(e) => patch(i, { labelEn: e.target.value || null })} /></div>
      {(q.type === "radio" || q.type === "checkbox") && <div className="space-y-1"><Label>선택지 (한 줄에 하나)</Label><Textarea value={(q.options ?? []).join("\n")} onChange={(e) => patch(i, { options: e.target.value.split(/\r?\n/) })} /></div>}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={q.required} onCheckedChange={(v) => patch(i, { required: v === true })} /> 필수 {q.type === "consent" && "(체크해야 신청됩니다)"}</label>
    </div>)}
    <div className="flex flex-wrap gap-2">{(Object.keys(LABELS) as Question["type"][]).map((type) => <Button key={type} variant="outline" size="sm" onClick={() => add(type)}>+ {LABELS[type]}</Button>)}</div>
    <p className="text-xs text-muted-foreground">개인정보를 묻는 문항은 꼭 필요한 경우에만 추가하세요.</p>
  </div>;
}

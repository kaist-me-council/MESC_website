/**
 * 반팔티 배부 시트 파서 — 순수 함수만 (테스트를 node 로 바로 돌리기 위해 alias import 없음).
 */
export const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;
export type Size = (typeof SIZES)[number];
export type Color = "white" | "black";

export interface Item {
  color: Color;
  size: Size;
  qty: number;
}

/** 폼 표기 → 표준 사이즈. "XL(LL)"→XL, "2XL(3L)"→2XL, "SS"→S */
export function normalizeSize(raw: string): Size | null {
  const s = raw.toUpperCase().replace(/\(.*?\)/g, "").trim();
  if (s === "SS") return "S";
  return (SIZES as readonly string[]).includes(s) ? (s as Size) : null;
}

/**
 * 배부 시트의 자유 텍스트 한 칸을 항목으로 파싱.
 * 예) "XL 1개", "XL", "M 1개 / L 1개", "2XL 1개 --> XL 1개로 수정", "2XL 1개 (환불처리)"
 * 반환: items + note(괄호·수정 이력 원문). 파싱 실패 조각은 unparsed 에.
 */
export function parseItemText(
  text: string | null | undefined,
  color: Color,
): { items: Item[]; note: string | null; unparsed: string[] } {
  if (!text || !text.trim()) return { items: [], note: null, unparsed: [] };
  let t = text.trim();
  const notes: string[] = [];
  const arrow = t.split(/-{1,2}>|→/); // "A --> B" 는 B 가 최종
  if (arrow.length > 1) {
    notes.push(`원래 ${arrow[0].trim()}`);
    t = arrow[arrow.length - 1];
  }
  t = t.replace(/[（(]([^)）]*)[)）]/g, (_, m: string) => { notes.push(m.trim()); return " "; });
  t = t.replace(/(으로|로)?\s*수정/g, " ");
  const items: Item[] = [];
  const unparsed: string[] = [];
  for (const part of t.split(/[/,·]/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^([0-9]?[A-Za-z]+(?:\([^)]*\))?)\s*(\d+)?\s*(?:개|벌)?$/);
    const size = m ? normalizeSize(m[1]) : null;
    if (!m || !size) { unparsed.push(p); continue; }
    items.push({ color, size, qty: m[2] ? parseInt(m[2], 10) : 1 });
  }
  return { items, note: notes.length ? notes.join("; ") : null, unparsed };
}

/** 최소 CSV 파서 (따옴표·셀 내 줄바꿈 지원). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

export interface ImportRow {
  affiliation: string;
  name: string;
  studentIdHash: string | null;
  email: string;
  phone: string | null;
  items: Item[];
  pickedUp: boolean;
  memo: string | null;
}

/**
 * "나눠주기" 시트 CSV → ImportRow[]. 헤더에서 열을 찾는다(구분/이름/학번/전화/이메일/흰/검/픽업).
 * 학번은 hash() 로 즉시 해시하고 원문은 버린다.
 */
export function parseDistributionCsv(
  text: string,
  hash: (studentId: string) => string,
): { rows: ImportRow[]; problems: string[] } {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], problems: ["CSV 에 데이터 행이 없습니다."] };
  const header = all[0].map((h) => h.trim());
  const col = (label: string) => header.findIndex((h) => h.includes(label));
  const ci = {
    aff: col("구분"), name: col("이름"), sid: col("학번"), phone: col("전화"),
    email: col("이메일"), white: col("흰"), black: col("검"), picked: col("픽업"),
  };
  const missing = Object.entries(ci).filter(([, v]) => v < 0).map(([k]) => k);
  if (missing.length) return { rows: [], problems: [`헤더에서 열을 찾지 못함: ${missing.join(", ")}`] };

  const rows: ImportRow[] = [];
  const problems: string[] = [];
  all.slice(1).forEach((r, idx) => {
    const name = (r[ci.name] ?? "").trim();
    if (!name) { problems.push(`${idx + 2}행: 이름 없음`); return; }
    const w = parseItemText(r[ci.white], "white");
    const b = parseItemText(r[ci.black], "black");
    const unparsed = [...w.unparsed, ...b.unparsed];
    if (unparsed.length) problems.push(`${idx + 2}행 ${name}: 해석 불가 "${unparsed.join('", "')}"`);
    const sidRaw = (r[ci.sid] ?? "").replace(/\D/g, "");
    const pickedRaw = (r[ci.picked] ?? "").trim().toUpperCase();
    rows.push({
      affiliation: (r[ci.aff] ?? "").trim() || "기타",
      name,
      studentIdHash: sidRaw ? hash(sidRaw) : null,
      email: (r[ci.email] ?? "").trim().toLowerCase(),
      phone: (r[ci.phone] ?? "").trim() || null,
      items: [...w.items, ...b.items],
      pickedUp: ["TRUE", "O", "Y", "1", "✓"].includes(pickedRaw),
      memo: [w.note, b.note].filter(Boolean).join("; ") || null,
    });
  });
  return { rows, problems };
}

// 사이트 설정 — 순수 타입/기본값/파서/포맷터 (DB·React 비의존)

// ── 운영시간 ──────────────────────────────────────────────
// day: 월=0 … 일=6
export interface DayHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  closed: boolean;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}
export interface OperatingHours {
  days: DayHours[];
  lunch: { open: string; close: string } | null;
}

export const WEEKDAY_LABELS: Record<"ko" | "en", string[]> = {
  ko: ["월", "화", "수", "목", "금", "토", "일"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  days: [
    { day: 0, closed: false, open: "09:00", close: "18:00" },
    { day: 1, closed: false, open: "09:00", close: "18:00" },
    { day: 2, closed: false, open: "09:00", close: "18:00" },
    { day: 3, closed: false, open: "09:00", close: "18:00" },
    { day: 4, closed: false, open: "09:00", close: "18:00" },
    { day: 5, closed: true, open: "09:00", close: "18:00" },
    { day: 6, closed: true, open: "09:00", close: "18:00" },
  ],
  lunch: { open: "12:00", close: "13:00" },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

/** JSON 문자열 → OperatingHours. 실패/누락 시 기본값. (parseGraph 패턴) */
export function parseHours(json: string | null | undefined): OperatingHours {
  if (!json) return DEFAULT_OPERATING_HOURS;
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data.days) || data.days.length !== 7) return DEFAULT_OPERATING_HOURS;
    const days: DayHours[] = data.days.map((d: Record<string, unknown>, i: number) => ({
      day: i as DayHours["day"],
      closed: Boolean(d.closed),
      open: isValidTime(d.open) ? (d.open as string) : "09:00",
      close: isValidTime(d.close) ? (d.close as string) : "18:00",
    }));
    const lunch =
      data.lunch && isValidTime(data.lunch.open) && isValidTime(data.lunch.close)
        ? { open: data.lunch.open as string, close: data.lunch.close as string }
        : null;
    return { days, lunch };
  } catch {
    return DEFAULT_OPERATING_HOURS;
  }
}

/** 평일(월~금) 표시 문자열. 모두 동일/영업 → "09:00 - 18:00", 모두 휴무 → null, 혼재 → 요일별 "월 09:00-18:00, …" */
export function formatWeekdayHours(h: OperatingHours, lang: "ko" | "en" = "ko"): string | null {
  const weekdays = h.days.filter((d) => d.day <= 4);
  const open = weekdays.filter((d) => !d.closed);
  if (open.length === 0) return null;
  const uniform =
    open.length === 5 &&
    open.every((d) => d.open === open[0].open && d.close === open[0].close);
  if (uniform) return `${open[0].open} - ${open[0].close}`;
  return open.map((d) => `${WEEKDAY_LABELS[lang][d.day]} ${d.open}-${d.close}`).join(", ");
}

/** 점심시간 표시 문자열 또는 null(미설정 시 행 숨김) */
export function formatLunch(h: OperatingHours): string | null {
  return h.lunch ? `${h.lunch.open} - ${h.lunch.close}` : null;
}

/** 주말(토·일) 모두 휴무인가 */
export function isWeekendClosed(h: OperatingHours): boolean {
  const weekend = h.days.filter((d) => d.day >= 5);
  return weekend.length > 0 && weekend.every((d) => d.closed);
}

/** 주말 영업 시 표시 문자열 (둘 중 하나라도 영업), 모두 휴무면 null */
export function formatWeekendHours(h: OperatingHours, lang: "ko" | "en" = "ko"): string | null {
  const weekend = h.days.filter((d) => d.day >= 5 && !d.closed);
  if (weekend.length === 0) return null;
  return weekend.map((d) => `${WEEKDAY_LABELS[lang][d.day]} ${d.open}-${d.close}`).join(", ");
}

// ── 동아리 색상 프리셋 ────────────────────────────────────
export const CLUB_COLOR_PRESETS: Record<string, string> = {
  blue: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
  orange: "from-orange-500/10 to-red-500/10 border-orange-500/20",
  green: "from-green-500/10 to-emerald-500/10 border-green-500/20",
  purple: "from-purple-500/10 to-pink-500/10 border-purple-500/20",
};
export const DEFAULT_CLUB_COLOR = CLUB_COLOR_PRESETS.blue;
export function getClubColor(preset: string | null | undefined): string {
  return (preset && CLUB_COLOR_PRESETS[preset]) || DEFAULT_CLUB_COLOR;
}

// ── 링크 카테고리 ─────────────────────────────────────────
export const LINK_CATEGORIES = ["important", "community"] as const;
export type LinkCategory = (typeof LINK_CATEGORIES)[number];

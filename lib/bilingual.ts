import type { Language } from "@/lib/i18n";

export function pick(lang: Language, ko: string, en?: string | null): string {
  return lang === "en" && en?.trim() ? en : ko;
}

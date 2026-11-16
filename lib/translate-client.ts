/** 관리자 화면 전용: 한국어 → 영어 초안 (/api/translate, 무료 구글 엔드포인트). 빈 문자열은 그대로. */
export async function translateKo(text: string): Promise<string> {
  if (!text.trim()) return "";
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "번역 실패");
  return data.text as string;
}

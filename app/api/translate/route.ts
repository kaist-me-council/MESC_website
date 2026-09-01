import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// ponytail: 비공식 구글 번역 엔드포인트(무키·무료) — 관리자 초안 채우기 용도.
// 차단/변경되면 공식 Translate API 또는 LLM API로 교체.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body as { text?: unknown }).text;
  if (typeof text !== "string" || !text.trim() || text.length > 10000) {
    return NextResponse.json({ error: "번역할 텍스트가 없거나 너무 깁니다." }, { status: 400 });
  }

  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ q: text }),
      }
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data: unknown = await res.json();
    const segments = Array.isArray(data) ? data[0] : null;
    const translated = Array.isArray(segments)
      ? segments.map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : "")).join("")
      : "";
    if (!translated.trim()) throw new Error("empty result");
    return NextResponse.json({ text: translated });
  } catch {
    return NextResponse.json(
      { error: "자동 번역에 실패했습니다. 잠시 후 다시 시도하거나 직접 입력해주세요." },
      { status: 502 }
    );
  }
}

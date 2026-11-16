"use client";

import { useMemo, useState } from "react";
import { encode } from "uqr";
import { Copy, Download, Link2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

// layout.tsx·sitemap.ts 와 같은 규칙. window.location.origin 은 localhost 에서 잘못된 QR 을 만든다.
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://mesc-website.vercel.app";
const PX = 32; // PNG 한 칸 크기 → 약 1000px, 포스터 인쇄에 충분

type Tone = "black" | "white";

/** 배경 없는(투명) QR — 검정/흰색 버전, PNG 복사·다운로드, SVG 다운로드 */
export function QrPanel({ path, name }: { path: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<Tone>("black");
  const [msg, setMsg] = useState("");
  const url = `${SITE}${path}`;
  const qr = useMemo(() => encode(url, { ecc: "M", border: 2 }), [url]);
  const color = tone === "black" ? "#000" : "#fff";
  const file = `qr-${name}-${tone}`;

  const d = qr.data.flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : ""))).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><path fill="${color}" d="${d}"/></svg>`;

  const png = () =>
    new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = qr.size * PX;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      qr.data.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect(x * PX, y * PX, PX, PX)));
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 생성 실패"))), "image/png");
    });

  const save = (blob: Blob, ext: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(""), 1800); };
  async function copyImage() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png() })]);
      flash("이미지 복사됨");
    } catch {
      flash("이 브라우저는 이미지 복사를 막습니다 — PNG 다운로드를 쓰세요");
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <QrCode className="h-3.5 w-3.5" aria-hidden="true" /> QR 코드
      </Button>
    );
  }

  return (
    <div className="w-full rounded-xl border bg-card p-4 flex flex-col sm:flex-row gap-4">
      <div
        className={`h-40 w-40 shrink-0 rounded-lg p-2 ${tone === "black" ? "bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)]" : "bg-[repeating-conic-gradient(#333_0_25%,#555_0_50%)]"} bg-[length:16px_16px] [&>svg]:h-full [&>svg]:w-full`}
        aria-label={`${url} 로 연결되는 QR 코드 미리보기`}
        role="img"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0 flex-1 space-y-3 text-sm">
        <p className="break-all text-muted-foreground">{url}</p>
        <div className="flex gap-2" role="radiogroup" aria-label="QR 색상">
          {(["black", "white"] as const).map((t) => (
            <Button key={t} type="button" size="sm" variant={tone === t ? "default" : "outline"} role="radio" aria-checked={tone === t} onClick={() => setTone(t)}>
              {t === "black" ? "블랙 (밝은 배경용)" : "화이트 (어두운 배경용)"}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void copyImage()}><Copy className="h-3.5 w-3.5" aria-hidden="true" /> 이미지 복사</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void png().then((b) => save(b, "png"))}><Download className="h-3.5 w-3.5" aria-hidden="true" /> PNG</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => save(new Blob([svg], { type: "image/svg+xml" }), "svg")}><Download className="h-3.5 w-3.5" aria-hidden="true" /> SVG</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(url).then(() => flash("링크 복사됨"))}><Link2 className="h-3.5 w-3.5" aria-hidden="true" /> 링크 복사</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>닫기</Button>
        </div>
        {msg && <p className="text-xs text-primary" role="status">{msg}</p>}
      </div>
    </div>
  );
}

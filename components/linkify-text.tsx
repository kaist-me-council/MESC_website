import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

/** 일반 텍스트를 줄바꿈 유지 + URL 자동 링크로 렌더. 마크다운 없음. */
export function LinkifyText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={`whitespace-pre-wrap ${className ?? ""}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline text-primary break-all">{p}</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

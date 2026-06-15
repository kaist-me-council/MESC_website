"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0f172a",
          color: "#f8fafc",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.75rem" }}>
            문제가 발생했습니다
          </h1>
          <p style={{ color: "#94a3b8", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              height: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}

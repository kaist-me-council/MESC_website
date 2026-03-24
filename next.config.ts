import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "better-sqlite3"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // 클릭재킹 방지: 동일 출처 iframe만 허용
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // MIME 스니핑 방지
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer 정책: 크로스 오리진 요청 시 origin만 전송
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 브라우저 기능 제한 (카메라·마이크·위치 비활성화)
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // DNS 프리페치 허용 (성능)
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;

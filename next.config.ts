import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "me.kaist.ac.kr",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HTTPS 강제 (production 도메인 https 사용 시)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com https://drive.google.com https://me.kaist.ac.kr",
              "frame-src https://calendar.google.com https://docs.google.com",
              "connect-src 'self' https://*.public.blob.vercel-storage.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

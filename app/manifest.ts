import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KAIST 기계공학과 학생회",
    short_name: "기계과 학생회",
    description: "KAIST 기계공학과 학생회 공식 웹사이트",
    start_url: "/",
    display: "standalone",
    background_color: "#041c46",
    theme_color: "#062e6e",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable 은 안전 영역 여백이 있는 별도 파일 (안드로이드 원형/스쿼클 크롭 대응)
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

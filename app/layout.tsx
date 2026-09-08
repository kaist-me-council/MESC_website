import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { getFooterData } from "@/lib/site-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mesc-website.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "기계공학과 학생회",
    template: "%s | 기계공학과 학생회",
  },
  description: "기계공학과 학생회 공식 웹사이트 - 공지사항, 학습자료, 캘린더 등을 확인하세요.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "기계과 학생회",
  },
  // 아이콘·OG 이미지는 app/icon.svg · app/apple-icon.png · app/opengraph-image.png
  // 파일 컨벤션으로 자동 주입된다 (scripts/make-icons.mjs 로 생성).
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "기계공학과 학생회",
    title: "기계공학과 학생회",
    description: "기계공학과 학생회 공식 웹사이트 - 공지사항, 학습자료, 캘린더 등을 확인하세요.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "기계공학과 학생회",
    description: "기계공학과 학생회 공식 웹사이트",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const footerData = await getFooterData();
  return (
    <html lang="ko" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#062e6e" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LayoutWrapper footerData={footerData}>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";

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
  description: "기계공학과 학생회 공식 웹사이트 - 공지사항, 학습자료, 예산 내역, 캘린더 등을 확인하세요.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "기계과 학생회",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "기계공학과 학생회",
    title: "기계공학과 학생회",
    description: "기계공학과 학생회 공식 웹사이트 - 공지사항, 학습자료, 예산 내역, 캘린더 등을 확인하세요.",
    url: SITE_URL,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "기계공학과 학생회" }],
  },
  twitter: {
    card: "summary",
    title: "기계공학과 학생회",
    description: "기계공학과 학생회 공식 웹사이트",
    images: ["/icons/icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

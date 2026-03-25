import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "기계공학과 학생회",
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

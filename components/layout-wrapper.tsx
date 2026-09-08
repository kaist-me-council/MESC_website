"use client"

import { ThemeProvider } from "./theme-provider"
import { LanguageProvider } from "@/lib/language-context"
import { PushProvider } from "./push-provider"
import Navbar from "./Navbar"
import Footer from "./Footer"
import type { FooterData } from "@/lib/site-settings"

export function LayoutWrapper({ children, footerData }: { children: React.ReactNode; footerData?: FooterData }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        {/* 알림 토글이 페이지와 푸터 두 곳에 있으므로 상태는 여기서 하나로 소유한다 */}
        <PushProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer data={footerData} />
        </PushProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

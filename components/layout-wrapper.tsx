"use client"

import { ThemeProvider } from "./theme-provider"
import { LanguageProvider } from "@/lib/language-context"
import Navbar from "./Navbar"
import Footer from "./Footer"
import type { FooterData } from "@/lib/site-settings"

export function LayoutWrapper({ children, footerData }: { children: React.ReactNode; footerData?: FooterData }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer data={footerData} />
      </LanguageProvider>
    </ThemeProvider>
  )
}

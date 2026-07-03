import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, Home, Bell, BookOpen, BookMarked, Calendar, PieChart, CreditCard, Users, Settings, GraduationCap, MessageSquare, MapPin } from "lucide-react";
import { useState } from "react";
import { ModeToggle } from "./mode-toggle";
import { useLanguage } from "@/lib/language-context";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();

  const navLinks = [
    { href: "/", label: t("navbar.home"), icon: Home },
    { href: "/notices", label: t("navbar.notices"), icon: Bell },
    { href: "/resources", label: t("navbar.resources"), icon: BookOpen },
    { href: "/library", label: t("navbar.library"), icon: BookMarked },
    { href: "/calendar", label: t("navbar.calendar"), icon: Calendar },
    { href: "/budget", label: t("navbar.budget"), icon: PieChart },
    { href: "/check-fee", label: t("navbar.checkFee"), icon: CreditCard },
    { href: "/members", label: t("navbar.members"), icon: Users },
    { href: "/department-info", label: t("navbar.deptInfo"), icon: MapPin },
    { href: "/courses", label: t("navbar.courses"), icon: GraduationCap },
    { href: "/community", label: t("navbar.community"), icon: MessageSquare },
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass-premium border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105 flex-shrink-0">
              <span className="font-black text-lg leading-none tracking-tighter">ME</span>
              <div className="absolute inset-0 rounded-lg border border-primary-foreground/10" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-base tracking-tight text-foreground">ME Council</span>
              <span className="hidden sm:inline text-xs text-muted-foreground font-bold">{t("navbar.subtitle")}</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-16">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 group whitespace-nowrap",
                    isActive
                      ? "text-primary bg-primary/10 shadow-md shadow-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 transition-all duration-300 flex-shrink-0",
                    isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span className="hidden sm:inline">{link.label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-lg shadow-primary/50" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === "ko" ? "en" : "ko")}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/40 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border transition-all duration-300"
              aria-label="Switch language"
            >
              <span className="text-sm">{lang === "ko" ? "🇺🇸" : "🇰🇷"}</span>
              <span>{lang === "ko" ? t("common.english") : t("common.korean")}</span>
            </button>

            <ModeToggle />

            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border transition-all duration-300 group"
            >
              <Settings className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500 flex-shrink-0" />
              <span className="hidden md:inline">{t("navbar.admin")}</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors duration-300 text-muted-foreground hover:text-foreground"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-md animate-in slide-in-from-top-2 duration-300">
          <nav className="container mx-auto px-4 py-6 grid grid-cols-3 gap-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 group",
                    isActive
                      ? "bg-primary/10 border-primary/30 text-primary shadow-md shadow-primary/10"
                      : "border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "h-6 w-6 mb-2 transition-all duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                  <span className="text-xs font-semibold text-center leading-tight">{link.label}</span>
                </Link>
              );
            })}
            {/* Mobile Lang + Admin row */}
            <div className="col-span-3 flex gap-3">
              <button
                onClick={() => setLang(lang === "ko" ? "en" : "ko")}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all"
              >
                <span>{lang === "ko" ? "🇺🇸" : "🇰🇷"}</span>
                <span className="text-xs font-semibold">{lang === "ko" ? t("common.english") : t("common.korean")}</span>
              </button>
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all"
              >
                <Settings className="h-4 w-4" />
                <span className="text-xs font-semibold">{t("navbar.admin")}</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

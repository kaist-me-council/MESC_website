import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, Bell, BookOpen, BookMarked, Calendar, PieChart, CreditCard, Users, Settings, GraduationCap, MessageSquare, MapPin, LifeBuoy, ChevronDown, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ModeToggle } from "./mode-toggle";
import { useLanguage } from "@/lib/language-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavItem =
  | ({ type: "link" } & NavLink)
  | { type: "group"; label: string; icon: LucideIcon; items: NavLink[] };

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();

  const navItems: NavItem[] = [
    { type: "link", href: "/notices", label: t("navbar.notices"), icon: Bell },
    {
      type: "group",
      label: t("navbar.groupLectures"),
      icon: GraduationCap,
      items: [
        { href: "/resources", label: t("navbar.resources"), icon: BookOpen },
        { href: "/library", label: t("navbar.library"), icon: BookMarked },
        { href: "/courses", label: t("navbar.courses"), icon: GraduationCap },
      ],
    },
    {
      type: "group",
      label: t("navbar.groupSchedule"),
      icon: Calendar,
      items: [
        { href: "/calendar", label: t("navbar.calendar"), icon: Calendar },
        { href: "/budget", label: t("navbar.budget"), icon: PieChart },
        { href: "/check-fee", label: t("navbar.checkFee"), icon: CreditCard },
      ],
    },
    {
      type: "group",
      label: t("navbar.groupHelper"),
      icon: LifeBuoy,
      items: [
        { href: "/members", label: t("navbar.members"), icon: Users },
        { href: "/department-info", label: t("navbar.deptInfo"), icon: MapPin },
      ],
    },
    { type: "link", href: "/community", label: t("navbar.community"), icon: MessageSquare },
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
            {navItems.map((item) => {
              if (item.type === "link") {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-lg shadow-primary/50" />
                    )}
                  </Link>
                );
              }

              const Icon = item.icon;
              const isActive = item.items.some((sub) => pathname === sub.href);
              return (
                <DropdownMenu key={item.label} modal={false}>
                  <DropdownMenuTrigger
                    openOnHover
                    delay={80}
                    className={cn(
                      "relative px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 group whitespace-nowrap outline-none data-popup-open:bg-muted/60",
                      isActive
                        ? "text-primary bg-primary/10 shadow-md shadow-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 transition-all duration-300 flex-shrink-0",
                      isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span>{item.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-data-[popup-open]:rotate-180 flex-shrink-0" />
                    {isActive && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-lg shadow-primary/50" />
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="w-52">
                    {item.items.map((sub) => {
                      const SubIcon = sub.icon;
                      const subActive = pathname === sub.href;
                      return (
                        <DropdownMenuItem
                          key={sub.href}
                          className={cn(
                            "gap-2.5 py-2 font-semibold",
                            subActive && "text-primary bg-primary/10 focus:bg-primary/10 focus:text-primary"
                          )}
                          render={<Link href={sub.href} />}
                        >
                          <SubIcon className={cn("h-4 w-4", subActive ? "text-primary" : "text-muted-foreground")} />
                          <span>{sub.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
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
          <nav className="container mx-auto px-4 py-6 space-y-5">
            {navItems.map((item) => {
              if (item.type === "link") {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 group",
                      isActive
                        ? "bg-primary/10 border-primary/30 text-primary shadow-md shadow-primary/10"
                        : "border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-all duration-300 flex-shrink-0",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    <span className="text-sm font-semibold leading-tight">{item.label}</span>
                  </Link>
                );
              }

              return (
                <div key={item.label} className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {item.items.map((link) => {
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
                  </div>
                </div>
              );
            })}
            {/* Mobile Lang + Admin row */}
            <div className="flex gap-3 pt-2">
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

import Link from "next/link";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, Bell, BookOpen, BookMarked, Calendar, CreditCard, Users, Settings, GraduationCap, MessageSquare, MapPin, LifeBuoy, ChevronDown, ListChecks, PartyPopper, Images, Inbox, MessagesSquare, Cookie, type LucideIcon } from "lucide-react";
import { Suspense, useState } from "react";
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
  return (
    <Suspense fallback={<NavbarContent search={null} />}>
      <NavbarWithSearchParams />
    </Suspense>
  );
}

function NavbarWithSearchParams() {
  const searchParams = useSearchParams();
  return <NavbarContent search={searchParams} />;
}

function NavbarContent({ search }: { search: ReadonlyURLSearchParams | null }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();

  // 하위 항목 활성 판정: 경로가 같고, 같은 그룹의 형제 항목들이 사용하는 쿼리 키에 대해
  // 현재 URL 값과 항목 값이 일치할 때만 활성 (쿼리 없는 항목은 해당 키가 URL에 없어야 활성)
  const isSubActive = (sub: NavLink, siblings: NavLink[]) => {
    const [subPath, subQuery] = sub.href.split("?");
    if (pathname !== subPath) return false;
    const subParams = new URLSearchParams(subQuery ?? "");
    const keys = new Set<string>();
    siblings.forEach((s) => {
      const [sPath, sQuery] = s.href.split("?");
      if (sPath === subPath && sQuery) {
        new URLSearchParams(sQuery).forEach((_, key) => keys.add(key));
      }
    });
    for (const key of keys) {
      if ((search?.get(key) ?? null) !== subParams.get(key)) return false;
    }
    return true;
  };

  const navItems: NavItem[] = [
    {
      type: "group",
      label: t("navbar.groupNotices"),
      icon: Bell,
      items: [
        { href: "/notices", label: t("navbar.noticesAll"), icon: ListChecks },
        { href: "/notices?category=notice", label: t("navbar.noticesNotice"), icon: Bell },
        { href: "/notices?category=event", label: t("navbar.noticesEvent"), icon: PartyPopper },
        { href: "/notices?category=academic", label: t("navbar.noticesAcademic"), icon: GraduationCap },
      ],
    },
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
    {
      type: "group",
      label: t("navbar.groupCommunity"),
      icon: MessageSquare,
      items: [
        { href: "/community?tab=gallery", label: t("navbar.communityGallery"), icon: Images },
        { href: "/community?tab=suggestions", label: t("navbar.communitySuggestions"), icon: Inbox },
        { href: "/community?tab=board", label: t("navbar.communityBoard"), icon: MessagesSquare },
        { href: "/community?tab=wishlist", label: t("navbar.communityWishlist"), icon: Cookie },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass-premium border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-[box-shadow,transform] duration-300 group-hover:scale-105 flex-shrink-0">
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
                      "relative px-3 py-2 rounded-lg text-sm font-semibold transition-[color,background-color,box-shadow] duration-300 flex items-center gap-2 group whitespace-nowrap",
                      isActive
                        ? "text-primary bg-primary/10 shadow-md shadow-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 transition-[color,transform] duration-300 flex-shrink-0",
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
              const isActive = item.items.some((sub) => isSubActive(sub, item.items));
              return (
                <DropdownMenu key={item.label} modal={false}>
                  <DropdownMenuTrigger
                    openOnHover
                    delay={80}
                    className={cn(
                      "relative px-3 py-2 rounded-lg text-sm font-semibold transition-[color,background-color,box-shadow] duration-300 flex items-center gap-2 group whitespace-nowrap outline-none data-popup-open:bg-muted/60",
                      isActive
                        ? "text-primary bg-primary/10 shadow-md shadow-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 transition-[color,transform] duration-300 flex-shrink-0",
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
                      const subActive = isSubActive(sub, item.items);
                      return (
                        <DropdownMenuItem
                          key={sub.href}
                          className={cn(
                            "gap-2.5 px-2 py-2.5 font-semibold",
                            subActive
                              ? "bg-primary/10 text-primary focus:bg-primary/15 focus:text-primary"
                              : "text-foreground"
                          )}
                          render={<Link href={sub.href} />}
                        >
                          <SubIcon className={cn(
                            "h-4 w-4 shrink-0",
                            subActive
                              ? "text-primary"
                              : "text-muted-foreground group-focus/dropdown-menu-item:text-foreground"
                          )} />
                          <span>{sub.label}</span>
                          {subActive && (
                            <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40" />
                          )}
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
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/40 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border transition-[color,background-color,border-color] duration-300"
              aria-label="Switch language"
            >
              <span className="text-sm">{lang === "ko" ? "🇺🇸" : "🇰🇷"}</span>
              <span>{lang === "ko" ? t("common.english") : t("common.korean")}</span>
            </button>

            <ModeToggle />

            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border transition-[color,background-color,border-color] duration-300 group"
            >
              <Settings className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500 flex-shrink-0" />
              <span className="hidden md:inline">{t("navbar.admin")}</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? (lang === "ko" ? "메뉴 닫기" : "Close menu") : (lang === "ko" ? "메뉴 열기" : "Open menu")}
              aria-expanded={isMobileMenuOpen}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors duration-300 text-muted-foreground hover:text-foreground"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-md animate-in slide-in-from-top-2 duration-300 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
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
                      "relative flex items-center gap-3 p-3.5 rounded-xl border transition-[color,background-color,border-color,box-shadow] duration-300 group",
                      isActive
                        ? "bg-primary/10 border-primary/30 text-primary shadow-md shadow-primary/10"
                        : "border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-transform duration-300 flex-shrink-0",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    <span className="text-sm font-semibold leading-tight">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40" />
                    )}
                  </Link>
                );
              }

              return (
                <div key={item.label} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                    {item.items.map((link) => {
                      const Icon = link.icon;
                      const isActive = isSubActive(link, item.items);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl border transition-[color,background-color,border-color,box-shadow] duration-300 group",
                            isActive
                              ? "bg-primary/10 border-primary/30 text-primary shadow-md shadow-primary/10"
                              : "border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground active:bg-muted/60"
                          )}
                        >
                          {isActive && (
                            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary shadow-sm shadow-primary/40" />
                          )}
                          <Icon className={cn(
                            "h-6 w-6 transition-transform duration-300",
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
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-[color,background-color] duration-300"
              >
                <span>{lang === "ko" ? "🇺🇸" : "🇰🇷"}</span>
                <span className="text-xs font-semibold">{lang === "ko" ? t("common.english") : t("common.korean")}</span>
              </button>
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-[color,background-color] duration-300"
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

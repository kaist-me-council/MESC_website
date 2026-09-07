"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_GROUPS, findAdminMenu } from "@/lib/admin-menu";
import { ChevronRight, Home, Menu, Settings, ShieldCheck, X } from "lucide-react";

/** 관리자 공통 껍데기 — 헤더·4그룹 내비·현재 위치. 인증은 서버 layout 에서만 판단한다. */
export function AdminShell({ userName, signOutSlot, children }: {
  userName: string;
  signOutSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const current = findAdminMenu(pathname);
  const isDashboard = pathname === "/admin";

  // 닫을 때 초점을 메뉴 버튼으로 되돌린다
  const close = () => { setOpen(false); menuButton.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const navList = (
    <nav className="space-y-5" aria-label="관리자 메뉴">
      {ADMIN_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-2 mb-1.5 text-xs font-bold text-muted-foreground">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = current?.item.href === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                      active ? "bg-primary/10 font-semibold text-primary" : "text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "" : g.tint}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              ref={menuButton}
              variant="outline"
              size="sm"
              className="lg:hidden gap-1.5"
              aria-expanded={open}
              aria-controls="admin-mobile-menu"
              onClick={() => (open ? close() : setOpen(true))}
            >
              <Menu className="h-4 w-4" />
              메뉴
            </Button>
            <Link href="/admin" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm tracking-tight truncate">관리자 시스템</p>
                <p className="text-xs text-muted-foreground truncate">KAIST ME Council</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              {userName}
            </Badge>
            <Link href="/" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              홈
            </Link>
            {signOutSlot}
          </div>
        </div>

        {/* 모바일 메뉴 — 길면 자체 스크롤 */}
        {open && (
          <div id="admin-mobile-menu" className="lg:hidden border-t border-border/40 bg-background">
            <div className="container mx-auto px-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={close} className="gap-1.5">
                  <X className="h-4 w-4" />
                  닫기
                </Button>
              </div>
              {navList}
            </div>
          </div>
        )}
      </header>

      <div className="container mx-auto px-4 lg:flex lg:gap-8">
        <aside className="hidden lg:block w-56 shrink-0 py-8">
          <div className="sticky top-6">{navList}</div>
        </aside>

        <main className="flex-1 min-w-0">
          {!isDashboard && (
            <nav aria-label="현재 위치" className="flex items-center gap-1 pt-6 text-xs text-muted-foreground">
              <Link href="/admin" className="hover:text-foreground">관리자</Link>
              {current && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span>{current.group.title}</span>
                  <ChevronRight className="h-3 w-3" />
                  <Link href={current.item.href} className="font-medium text-foreground hover:underline">{current.item.label}</Link>
                </>
              )}
            </nav>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

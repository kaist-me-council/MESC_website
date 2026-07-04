"use client"

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Bell, BookOpen, Calendar, PieChart, CreditCard, ChevronRight, Pin,
  Zap, Clock, ArrowUpRight
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import HomePopupModal from "@/components/HomePopupModal";
import {
  formatWeekdayHours,
  formatLunch,
  isWeekendClosed,
  formatWeekendHours,
  DEFAULT_OPERATING_HOURS,
  type OperatingHours,
} from "@/lib/site-settings";

interface Notice {
  id: number;
  title: string;
  category: string;
  pinned: boolean;
  createdAt: Date;
}

interface HomeClientProps {
  notices: Notice[];
  hours?: OperatingHours;
}

export function HomeClient({ notices, hours }: HomeClientProps) {
  const { t, lang } = useLanguage();

  const oh: OperatingHours = hours ?? DEFAULT_OPERATING_HOURS;
  const weekdayHours = formatWeekdayHours(oh, lang);
  const lunchHours = formatLunch(oh);
  const weekendClosed = isWeekendClosed(oh);
  const weekendHours = formatWeekendHours(oh, lang);

  const features = [
    {
      href: "/check-fee",
      icon: CreditCard,
      label: t("features.checkFee.label"),
      desc: t("features.checkFee.desc"),
      lightColor: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
    },
    {
      href: "/calendar",
      icon: Calendar,
      label: t("features.calendar.label"),
      desc: t("features.calendar.desc"),
      lightColor: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300"
    },
    {
      href: "/budget",
      icon: PieChart,
      label: t("features.budget.label"),
      desc: t("features.budget.desc"),
      lightColor: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-300"
    },
    {
      href: "/resources",
      icon: BookOpen,
      label: t("features.resources.label"),
      desc: t("features.resources.desc"),
      lightColor: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300"
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <HomePopupModal />
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 md:pt-32 md:pb-40">
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10">
          <div className="tech-mesh opacity-30" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/15 blur-[120px] rounded-full opacity-50" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 blur-[100px] rounded-full opacity-40" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider uppercase border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Zap className="h-3 w-3" />
              <span>{t("home.badge")}</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-balance">
                {lang === "ko" ? (
                  <>
                    KAIST {t("home.title")}<br />
                    <span className="text-primary">{t("home.titleHighlight")}</span>
                  </>
                ) : (
                  <>
                    KAIST {t("home.title")}<br />
                    <span className="text-primary">{t("home.titleHighlight")}</span>
                  </>
                )}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                {t("home.description")}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <Link href="/notices">
                <Button size="lg" className="h-12 px-7 text-base rounded-xl font-semibold group shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95">
                  {t("home.viewNotices")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/check-fee">
                <Button size="lg" variant="outline" className="h-12 px-7 text-base rounded-xl font-semibold border-border/60 hover:bg-muted/50 transition-all hover:scale-105 active:scale-95">
                  {t("home.checkFee")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 -mt-12 md:-mt-16 mb-20 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href} className="group">
                <Card className="h-full border-border/50 shadow-md shadow-primary/5 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 rounded-2xl overflow-hidden hover-lift-premium animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: `${idx * 80}ms` }}>
                  <CardContent className="p-5 space-y-3">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${feature.lightColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-base group-hover:text-primary transition-colors">
                        {feature.label}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Notices Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 bg-primary rounded-full" />
                <h2 className="text-2xl font-black tracking-tight">{t("home.latestNotices")}</h2>
              </div>
              <Link href="/notices" className="group flex items-center text-sm font-bold text-primary hover:gap-2 transition-all">
                {t("home.viewAllNotices")}
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {notices.length === 0 ? (
              <Card className="border-dashed border-2 bg-muted/10 rounded-2xl">
                <CardContent className="py-16 text-center flex flex-col items-center gap-3">
                  <Bell className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">{t("home.noNotices")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {notices.map((notice, idx) => (
                  <Link key={notice.id} href={`/notices/${notice.id}`}>
                    <Card className="group border-border/50 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-300 cursor-pointer rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:shadow-primary/10 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            {notice.pinned && (
                              <Badge className="badge-premium text-[11px] px-1.5 py-0 h-4 flex items-center gap-1">
                                <Pin className="h-2.5 w-2.5 fill-current" /> {t("home.pinned")}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[11px] px-2 py-0 h-4 font-bold">
                              {notice.category}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                            {notice.title}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground font-bold">
                            {new Date(notice.createdAt).toLocaleDateString(
                              lang === "ko" ? "ko-KR" : "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Key Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 bg-accent rounded-full" />
                <h2 className="text-2xl font-black tracking-tight">{t("home.keyInfo")}</h2>
              </div>
            </div>

            {/* Fee Check Card */}
            <Card className="relative overflow-hidden border border-border/40 bg-card shadow-lg shadow-primary/5 rounded-2xl group hover-lift-premium transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
              <CardHeader className="relative z-10 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {t("home.feeCheckTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                  {t("home.feeCheckContent")}
                </p>
                <Link href="/check-fee" className="block">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-10 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
                    {t("home.feeCheckButton")}
                    <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Operating Hours */}
            <Card className="border-border/60 bg-card rounded-2xl overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  {t("home.operatingHours")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 px-2 rounded hover:bg-muted/40 transition-colors">
                  <span className="text-muted-foreground font-bold">{t("home.weekday")}</span>
                  <span className="font-bold text-foreground">{weekdayHours ?? t("home.closed")}</span>
                </div>
                {lunchHours && (
                  <div className="flex justify-between items-center py-2 px-2 rounded hover:bg-muted/40 transition-colors">
                    <span className="text-muted-foreground font-bold">{t("home.lunchTime")}</span>
                    <span className="font-bold text-foreground">{lunchHours}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 px-2 rounded hover:bg-red-500/5 transition-colors">
                  <span className="text-muted-foreground font-bold">{t("home.weekend")}</span>
                  <span className={weekendClosed ? "font-bold text-red-600 dark:text-red-400" : "font-bold text-foreground"}>
                    {weekendClosed ? t("home.closed") : weekendHours}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

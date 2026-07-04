"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-context";
import {
  Calendar,
  MapPin,
  AlertCircle,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string;
}

const ICAL_URL = process.env.NEXT_PUBLIC_ICAL_URL || "";

function formatICalDate(dateStr: string): string {
  if (!dateStr) return "-";
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}년 ${month}월 ${day}일`;
  } else {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const minute = dateStr.substring(11, 13);
    return `${year}년 ${month}월 ${day}일 ${hour}:${minute}`;
  }
}

function getEventColor(index: number): string {
  const colors = [
    "bg-blue-500/10 border-l-blue-500 text-blue-700 dark:text-blue-400",
    "bg-purple-500/10 border-l-purple-500 text-purple-700 dark:text-purple-400",
    "bg-pink-500/10 border-l-pink-500 text-pink-700 dark:text-pink-400",
    "bg-green-500/10 border-l-green-500 text-green-700 dark:text-green-400",
    "bg-orange-500/10 border-l-orange-500 text-orange-700 dark:text-orange-400",
  ];
  return colors[index % colors.length];
}

export default function CalendarPage() {
  const { t } = useLanguage();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  useEffect(() => {
    setLoading(true);
    fetch("/api/calendar-events")
      .then((r) => r.json())
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          setEvents(Array.isArray(result) ? result : []);
        }
      })
      .catch(() => setError(t("calendar.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const handleGoogleSubscribe = () => {
    if (ICAL_URL) {
      const googleCalUrl = `https://www.google.com/calendar/render?cid=${encodeURIComponent(ICAL_URL)}`;
      window.open(googleCalUrl, "_blank");
    }
  };

  const handleICalDownload = () => {
    if (ICAL_URL) {
      window.open(ICAL_URL, "_blank");
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToThisMonth = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth()));
  };

  const confirmSelection = () => {
    setCurrentMonth(new Date(selectedYear, selectedMonth));
    setShowModal(false);
  };

  const handleOpenModal = () => {
    setSelectedYear(currentMonth.getFullYear());
    setSelectedMonth(currentMonth.getMonth());
    setShowModal(true);
  };

  // 현재 월의 이벤트 필터링
  const monthStr = `${currentMonth.getFullYear()}${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((e) => e.startDate.startsWith(monthStr));

  // 연도 범위 생성 (현재 연도 ±5년)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-muted/40 to-muted/20 border-b border-border/40 py-16 md:py-24">
        <div className="absolute inset-0 tech-mesh opacity-20 -z-10" />
        <div className="container mx-auto px-4">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider uppercase border border-primary/20">
              <Calendar className="h-3.5 w-3.5" />
              <span>{t("calendar.badge")}</span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">{t("calendar.title")}</h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                {t("calendar.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button
            onClick={handleGoogleSubscribe}
            disabled={!ICAL_URL}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("calendar.subscribeGoogle")}
          </Button>
          <Button
            variant="outline"
            onClick={handleICalDownload}
            disabled={!ICAL_URL}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t("calendar.subscribeApple")}
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-muted-foreground font-medium">
            {t("notices.loading")}
          </div>
        )}

        {/* Calendar View */}
        {!loading && (
          <div className="space-y-8">
            {/* Month Navigation */}
            <Card className="border-border/50 rounded-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <button
                    onClick={handleOpenModal}
                    className="px-6 py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-left font-bold text-lg tracking-tight flex-1 min-w-fit hover:shadow-md"
                  >
                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                  </button>

                  {/* Navigation Arrows */}
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={prevMonth}
                      className="h-10 w-10 p-0"
                      title="이전 달"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToThisMonth}
                      className="text-xs font-bold px-3"
                      title="현재 달로 이동"
                    >
                      이번 달
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={nextMonth}
                      className="h-10 w-10 p-0"
                      title="다음 달"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Year/Month Selection Modal */}
            {showModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-md border-border/50 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                  <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
                    <CardTitle className="text-xl font-black">날짜 선택</CardTitle>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-2.5 hover:bg-muted rounded-lg transition-colors"
                      title="닫기"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-6">
                    {/* Year Selection */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">연도 선택</p>
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-2">
                        {years.map((year) => (
                          <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                              year === selectedYear
                                ? "bg-primary text-primary-foreground shadow-md scale-105"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Month Selection */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">월 선택</p>
                      <div className="grid grid-cols-4 gap-2">
                        {months.map((month) => (
                          <button
                            key={month}
                            onClick={() => setSelectedMonth(month)}
                            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                              month === selectedMonth
                                ? "bg-primary text-primary-foreground shadow-md scale-105"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            {month + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-border/40">
                      <Button
                        variant="outline"
                        onClick={() => setShowModal(false)}
                        className="flex-1"
                      >
                        취소
                      </Button>
                      <Button
                        onClick={confirmSelection}
                        className="flex-1"
                      >
                        확인
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Events List */}
            {monthEvents.length === 0 ? (
              <Card className="border-dashed border-2 bg-muted/10 rounded-xl">
                <CardContent className="py-16 text-center flex flex-col items-center gap-3">
                  <Calendar className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">
                    이 달에 예정된 일정이 없습니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {monthEvents.map((event, idx) => (
                  <Card
                    key={event.id}
                    className={`border-l-4 rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 ${getEventColor(idx)}`}
                  >
                    <CardContent className="p-5">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-bold text-lg">{event.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatICalDate(event.startDate)}
                            {event.endDate && event.endDate !== event.startDate && (
                              <> ~ {formatICalDate(event.endDate)}</>
                            )}
                          </p>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Upcoming Events */}
            {events.length > 0 && (
              <div className="space-y-4 mt-12">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">다가오는 일정</h2>
                    <p className="text-xs text-muted-foreground font-medium mt-1">전체 일정 중 가장 가까운 5개</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.slice(0, 5).map((event, idx) => (
                    <Card key={event.id} className="border-border/50 rounded-xl hover:border-primary/40 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{event.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatICalDate(event.startDate)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mt-8 p-5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
          <Card className="border-border/50 rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                📱 {t("calendar.mobileTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>iPhone / iPad:</strong> {t("calendar.iphoneDesc")}</p>
              <p><strong>Android:</strong> {t("calendar.androidDesc")}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                ℹ️ {t("calendar.infoTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{t("calendar.realtimeDesc")}</p>
              <p>{t("calendar.autoSync")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

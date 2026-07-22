"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { pick } from "@/lib/bilingual";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Youtube, BookMarked, FileText, ChevronRight, Star, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Course {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  level: string;
  description: string | null;
  descriptionEn: string | null;
  textbook: string | null;
  textbookAvailable: boolean;
  youtubeUrl: string | null;
  order: number;
  averageRating: number | null;
  reviewCount: number;
}

const LEVELS = ["전체", "200", "300", "400", "기타"];

export default function CoursesPage() {
  const { lang, t } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeLevel, setActiveLevel] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => { setCourses(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = activeLevel === "전체" ? courses : courses.filter((c) => c.level === activeLevel);
  const levelLabels: Record<string, string> = {
    "전체": t("courses.all"),
    "200": t("courses.level200"),
    "300": t("courses.level300"),
    "400": t("courses.level400"),
    "기타": t("courses.other"),
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10">

        <h1 className="text-4xl font-black tracking-tight mb-2">
          {t("courses.title")}
        </h1>
        <p className="text-pretty text-muted-foreground">
          {t("courses.description")}
        </p>
      </div>

      {/* 레벨 탭 */}
      <div className="flex gap-2 mb-8 flex-wrap" role="tablist" aria-label={t("courses.title")}>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setActiveLevel(lv)}
            role="tab"
            aria-selected={activeLevel === lv}
            className={`min-h-10 px-4 py-2 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow,scale] active:scale-[0.96] ${
              activeLevel === lv
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {levelLabels[lv]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t("courses.loadError")}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p>{t("courses.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((course) => {
            const courseName = pick(lang, course.name, course.nameEn);
            const courseDescription = course.description ? pick(lang, course.description, course.descriptionEn) : null;

            return (
              <Link key={course.id} href={`/courses/${course.code}`}>
                <Card className="hover-lift-premium cursor-pointer h-full border-border/60 rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs font-mono">{course.code}</Badge>
                          <Badge className="text-xs">{levelLabels[course.level] ?? course.level}</Badge>
                        </div>
                        <h3 className="font-bold text-lg leading-tight">{courseName}</h3>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>

                    {courseDescription && (
                      <p className="text-pretty text-sm text-muted-foreground line-clamp-2 mb-3">{courseDescription}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {course.averageRating !== null && course.reviewCount > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="font-semibold tabular-nums">{course.averageRating.toFixed(1)}</span>
                          <span className="text-muted-foreground tabular-nums">({course.reviewCount})</span>
                        </div>
                      )}
                      {course.textbook && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookMarked className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{course.textbook}</span>
                        </div>
                      )}
                      {course.textbookAvailable && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <BookOpen className="h-3 w-3" />
                          {t("courses.available")}
                        </Badge>
                      )}
                      {course.youtubeUrl && (
                        <Badge variant="secondary" className="text-xs gap-1 text-red-500">
                          <Youtube className="h-3 w-3" />
                          {t("courses.lecture")}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        {t("courses.materials")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

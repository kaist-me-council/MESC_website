"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Youtube, BookMarked, FileText, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Course {
  id: number;
  code: string;
  name: string;
  level: string;
  description: string | null;
  textbook: string | null;
  textbookAvailable: boolean;
  youtubeUrl: string | null;
  order: number;
}

const LEVELS = ["전체", "200", "300", "400", "기타"];
const LEVEL_LABELS: Record<string, string> = {
  "전체": "전체",
  "200": "200번대",
  "300": "300번대",
  "400": "400번대",
  "기타": "기타",
};

export default function CoursesPage() {
  const { lang: language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeLevel, setActiveLevel] = useState("전체");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => { setCourses(data); setLoading(false); });
  }, []);

  const filtered = activeLevel === "전체" ? courses : courses.filter((c) => c.level === activeLevel);

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10">

        <h1 className="text-4xl font-black tracking-tight mb-2">
          {language === "ko" ? "수업 정보" : "Courses"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ko"
            ? "KAIST 기계공학과 전공 과목 정보, 전공서, 강의 영상 및 족보를 확인하세요."
            : "View course info, textbooks, lecture videos, and study materials for KAIST ME."}
        </p>
      </div>

      {/* 레벨 탭 */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setActiveLevel(lv)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeLevel === lv
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {LEVEL_LABELS[lv]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p>{language === "ko" ? "등록된 과목이 없습니다." : "No courses registered."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((course) => (
            <Link key={course.id} href={`/courses/${course.code}`}>
              <Card className="hover-lift-premium cursor-pointer h-full border-border/60 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs font-mono">{course.code}</Badge>
                        <Badge className="text-xs">{LEVEL_LABELS[course.level] ?? course.level}</Badge>
                      </div>
                      <h3 className="font-bold text-lg leading-tight">{course.name}</h3>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>

                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {course.textbook && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookMarked className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{course.textbook}</span>
                      </div>
                    )}
                    {course.textbookAvailable && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <BookOpen className="h-3 w-3" />
                        {language === "ko" ? "학생회 보유" : "Available"}
                      </Badge>
                    )}
                    {course.youtubeUrl && (
                      <Badge variant="secondary" className="text-xs gap-1 text-red-500">
                        <Youtube className="h-3 w-3" />
                        {language === "ko" ? "강의 영상" : "Lecture"}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />
                      {language === "ko" ? "족보 보기" : "Materials"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

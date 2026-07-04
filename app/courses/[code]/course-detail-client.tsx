"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Youtube, BookMarked, ExternalLink, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { pick } from "@/lib/bilingual";
import CourseReviews from "./course-reviews";

interface CourseDetail {
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
}

interface Resource {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
}

export default function CourseDetailClient({ course, resources }: { course: CourseDetail; resources: Resource[] }) {
  const { lang, t } = useLanguage();
  const levelLabel: Record<string, string> = {
    "200": t("courses.level200"),
    "300": t("courses.level300"),
    "400": t("courses.level400"),
    "기타": t("courses.other"),
  };
  const courseName = pick(lang, course.name, course.nameEn);
  const description = course.description ? pick(lang, course.description, course.descriptionEn) : null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link href="/courses" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t("courses.backToList")}
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono">{course.code}</Badge>
          <Badge>{levelLabel[course.level] ?? course.level}</Badge>
        </div>
        <h1 className="text-balance text-3xl font-black tracking-tight mb-3">{courseName}</h1>
        {description && (
          <p className="text-pretty text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {course.textbook && (
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <BookMarked className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("courses.textbook")}</p>
                <p className="font-semibold text-sm">{course.textbook}</p>
                {course.textbookAvailable && (
                  <Badge variant="secondary" className="mt-2 text-xs gap-1">
                    <BookOpen className="h-3 w-3" />
                    {t("courses.available")}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {course.youtubeUrl && (
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <Youtube className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("courses.lecture")}</p>
                <a
                  href={course.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {t("courses.watchYoutube")} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          {t("courses.resourcesTitle")} ({t("courses.resourceCount").replace("{count}", String(resources.length))})
        </h2>
        {resources.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">{t("courses.noResources")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((resource) => (
              <a key={resource.id} href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                <Card className="hover-lift-premium border-border/60 rounded-xl cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{resource.title}</p>
                      {resource.description && <p className="text-xs text-muted-foreground mt-0.5">{resource.description}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>

      <CourseReviews courseId={course.id} />
    </div>
  );
}

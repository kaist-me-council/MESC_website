import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Youtube, BookMarked, ExternalLink, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function CourseDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const course = await prisma.course.findUnique({ where: { code } });
  if (!course) notFound();

  const resources = await prisma.resource.findMany({
    where: { courseCode: code },
    orderBy: { createdAt: "desc" },
  });

  const levelLabel: Record<string, string> = { "200": "200번대", "300": "300번대", "400": "400번대", "기타": "기타" };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        수업 목록으로
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono">{course.code}</Badge>
          <Badge>{levelLabel[course.level] ?? course.level}</Badge>
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-3">{course.name}</h1>
        {course.description && (
          <p className="text-muted-foreground leading-relaxed">{course.description}</p>
        )}
      </div>

      {/* 전공서 & 강의 영상 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {course.textbook && (
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <BookMarked className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">전공서</p>
                <p className="font-semibold text-sm">{course.textbook}</p>
                {course.textbookAvailable && (
                  <Badge variant="secondary" className="mt-2 text-xs gap-1">
                    <BookOpen className="h-3 w-3" />
                    학생회 보유
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
                <p className="text-xs text-muted-foreground mb-1">강의 영상</p>
                <a
                  href={course.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sm text-primary hover:underline flex items-center gap-1"
                >
                  유튜브에서 보기 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 족보/학습자료 */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          족보 및 학습자료 ({resources.length}개)
        </h2>
        {resources.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">등록된 자료가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => (
              <a key={r.id} href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                <Card className="hover-lift-premium border-border/60 rounded-xl cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

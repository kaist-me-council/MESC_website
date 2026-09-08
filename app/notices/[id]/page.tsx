"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { ViewTracker } from "@/components/view-tracker";
import { Eye, Paperclip, Download } from "lucide-react";

interface Attachment { id: number; name: string; url: string; downloadUrl?: string; size: number; mime: string }

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

interface Notice {
  id: number;
  title: string;
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  category: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  attachments?: Attachment[];
}

export default function NoticeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();

  useEffect(() => {
    fetch(`/api/notices/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setNotice(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
        {t("notices.loading")}
      </div>
    );
  }

  if (!notice || (notice as { error?: string }).error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">
          {lang === "ko" ? "공지사항을 찾을 수 없습니다." : "Notice not found."}
        </p>
        <Button className="mt-4 min-h-10" onClick={() => router.push("/notices")}>
          {lang === "ko" ? "목록으로" : "Back to list"}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <ViewTracker kind="notice" id={notice.id} />
      <div className="mb-6">
        <Link
          href="/notices"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("notices.title")}
        </Link>
      </div>
      <article>
        <div className="flex items-center gap-2 mb-3">
          {notice.pinned && (
            <Badge variant="destructive">📌 {t("notices.pinned")}</Badge>
          )}
          <Badge variant="secondary">
            {notice.category === "공지" ? t("notices.notice")
              : notice.category === "행사" ? t("notices.event")
              : notice.category === "학사" ? t("notices.academic")
              : notice.category}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold mb-3">
          {lang === "en" && notice.titleEn ? notice.titleEn : notice.title}
        </h1>
        <p className="text-sm text-muted-foreground mb-6 flex items-center gap-3">
          <span>
            {new Date(notice.createdAt).toLocaleDateString(
              lang === "ko" ? "ko-KR" : "en-US",
              { year: "numeric", month: "long", day: "numeric" }
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">{notice.viewCount ?? 0}</span>
            <span className="sr-only">{t("common.views")}</span>
          </span>
        </p>
        <div className="border-t pt-6">
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {lang === "en" && notice.contentEn ? notice.contentEn : notice.content}
          </div>
        </div>

        {!!notice.attachments?.length && (
          <section className="mt-8 border-t pt-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              {t("notices.attachments")} ({notice.attachments.length})
            </h2>
            <ul className="space-y-2">
              {notice.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.downloadUrl || a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{kb(a.size)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}

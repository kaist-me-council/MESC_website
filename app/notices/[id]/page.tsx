"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";

interface Notice {
  id: number;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
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
          <Badge variant="secondary">{notice.category}</Badge>
        </div>
        <h1 className="text-2xl font-bold mb-3">{notice.title}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {new Date(notice.createdAt).toLocaleDateString(
            lang === "ko" ? "ko-KR" : "en-US",
            { year: "numeric", month: "long", day: "numeric" }
          )}
        </p>
        <div className="border-t pt-6">
          <div className="whitespace-pre-wrap break-words leading-relaxed">{notice.content}</div>
        </div>
      </article>
    </div>
  );
}

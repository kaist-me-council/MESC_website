"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/language-context";
import { request, type ReqFail } from "@/lib/fetch-state";
import { LoadError } from "@/components/load-error";
import { NotificationToggle, InstallPrompt } from "@/components/notification-toggle";

interface Notice {
  id: number;
  title: string;
  titleEn: string | null;
  content: string;
  contentEn: string | null;
  category: string;
  pinned: boolean;
  createdAt: string;
}

const CATEGORY_SLUG_TO_KO: Record<string, string> = {
  notice: "공지",
  event: "행사",
  academic: "학사",
};

const CATEGORY_KO_TO_SLUG: Record<string, string> = {
  공지: "notice",
  행사: "event",
  학사: "academic",
};

function categoryFromSlug(slug: string | null): string {
  if (!slug) return "전체";
  return CATEGORY_SLUG_TO_KO[slug] ?? "전체";
}

function NoticesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [activeCategory, setActiveCategory] = useState(() =>
    categoryFromSlug(searchParams.get("category"))
  );
  const [loading, setLoading] = useState(true);
  const [fail, setFail] = useState<ReqFail | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const { t, lang } = useLanguage();

  const CATEGORIES = [
    { ko: "전체", label: t("notices.all") },
    { ko: "공지", label: t("notices.notice") },
    { ko: "행사", label: t("notices.event") },
    { ko: "학사", label: t("notices.academic") },
  ];

  useEffect(() => {
    let alive = true;
    // 통신 실패를 "공지 없음"으로 보여 주지 않기 위해 결과를 판별해서 담는다.
    request<Notice[]>("/api/notices").then((r) => {
      if (!alive) return;
      if (r.ok && Array.isArray(r.data)) { setNotices(r.data); setFail(null); }
      else setFail(r.ok ? { ok: false, kind: "server", status: 200, body: {} } : r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [retryTick]);

  // 뒤로가기 등으로 URL의 category 쿼리가 바뀌면 탭 상태를 동기화한다.
  useEffect(() => {
    setActiveCategory(categoryFromSlug(searchParams.get("category")));
  }, [searchParams]);

  const handleCategoryChange = (ko: string) => {
    setActiveCategory(ko);
    const slug = CATEGORY_KO_TO_SLUG[ko];
    router.replace(slug ? `/notices?category=${slug}` : "/notices", {
      scroll: false,
    });
  };

  const filtered =
    activeCategory === "전체"
      ? notices
      : notices.filter((n) => n.category === activeCategory);

  return (
    <div className="container mx-auto px-4 py-8">
      <InstallPrompt className="mb-4" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold">{t("notices.title")}</h1>
        <NotificationToggle />
      </div>
      <Tabs value={activeCategory} onValueChange={handleCategoryChange} className="mb-6">
        <TabsList>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.ko} value={cat.ko} className="min-h-10">
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t("notices.loading")}</div>
      ) : fail ? (
        <LoadError fail={fail} t={t} onRetry={() => { setLoading(true); setFail(null); setRetryTick((v) => v + 1); }} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("notices.empty")}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notice) => (
            <Link key={notice.id} href={`/notices/${notice.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {notice.pinned && (
                        <Badge variant="destructive" className="text-xs">
                          📌 {t("notices.pinned")}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORIES.find((c) => c.ko === notice.category)?.label ?? notice.category}
                      </Badge>
                    </div>
                    <h2 className="font-semibold truncate">
                      {lang === "en" && notice.titleEn ? notice.titleEn : notice.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {lang === "en" && notice.contentEn ? notice.contentEn : notice.content}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(notice.createdAt).toLocaleDateString(
                      lang === "ko" ? "ko-KR" : "en-US"
                    )}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NoticesPage() {
  return (
    <Suspense fallback={null}>
      <NoticesContent />
    </Suspense>
  );
}

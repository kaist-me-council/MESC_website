"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/language-context";

interface Resource {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  category: string;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "200": "📗",
  "300": "📘",
  "400": "📙",
  기타: "📁",
};

const NAVER_CAFE_URL = "https://cafe.naver.com/kaistme";

function isNaverCafe(url: string) {
  return url.includes("cafe.naver.com");
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();

  const CATEGORIES = [
    { ko: "전체", label: t("resources.all") },
    { ko: "200", label: "200레벨" },
    { ko: "300", label: "300레벨" },
    { ko: "400", label: "400레벨" },
    { ko: "기타", label: lang === "ko" ? "기타" : "Other" },
  ];

  useEffect(() => {
    fetch("/api/resources")
      .then((r) => r.json())
      .then((data) => {
        setResources(data);
        setLoading(false);
      });
  }, []);

  const filtered =
    activeCategory === "전체"
      ? resources
      : resources.filter((r) => r.category === activeCategory);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t("resources.title")}</h1>
          <p className="text-muted-foreground">{t("resources.subtitle")}</p>
        </div>
        <a href={NAVER_CAFE_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="gap-2 shrink-0">
            <span>☕</span>
            {t("resources.naverCafe")}
          </Button>
        </a>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
        <TabsList>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.ko} value={cat.ko}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t("resources.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-3">{t("resources.empty")}</p>
          <a href={NAVER_CAFE_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">{t("resources.findInCafe")}</Button>
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((resource) => (
            <a
              key={resource.id}
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="p-4 flex flex-col gap-2 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl">
                      {CATEGORY_ICONS[resource.category] ?? "📁"}
                    </span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {resource.category}
                      </Badge>
                      {isNaverCafe(resource.fileUrl) && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {t("resources.cafe")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <h2 className="font-semibold group-hover:text-primary transition-colors">
                    {resource.title}
                  </h2>
                  {resource.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {resource.description}
                    </p>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(resource.createdAt).toLocaleDateString(
                        lang === "ko" ? "ko-KR" : "en-US"
                      )}
                    </span>
                    <span className="text-xs text-primary font-medium">
                      {isNaverCafe(resource.fileUrl)
                        ? t("resources.goToCafe")
                        : t("resources.download")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

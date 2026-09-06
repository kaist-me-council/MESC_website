"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-context";
import { Ticket, ChevronRight } from "lucide-react";

interface CampaignSummary {
  slug: string;
  title: string;
  titleEn: string | null;
  open: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export default function ApplyListPage() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<CampaignSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/campaigns", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((d) => setItems(d.campaigns ?? []))
      .catch(() => setItems([]));
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const status = (c: CampaignSummary) => {
    if (c.open) return { label: t("apply.open"), variant: "default" as const };
    if (c.opensAt && new Date(c.opensAt) > new Date()) return { label: t("apply.notOpenYet"), variant: "secondary" as const };
    return { label: t("apply.closed"), variant: "outline" as const };
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Ticket className="h-7 w-7 text-primary" />{t("apply.listTitle")}</h1>
      <p className="text-muted-foreground mb-8">{t("apply.listSubtitle")}</p>

      {items === null && <p className="text-sm text-muted-foreground">{t("apply.loading")}</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">{t("apply.listEmpty")}</p>}

      <div className="space-y-3">
        {items?.map((c) => {
          const s = status(c);
          return (
            <Link key={c.slug} href={`/apply/${c.slug}`} className="block">
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                    </div>
                    <p className="font-semibold truncate">{lang === "en" && c.titleEn ? c.titleEn : c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.opensAt && `${t("apply.from")} ${fmt(c.opensAt)}`}
                      {c.opensAt && c.closesAt && " · "}
                      {c.closesAt && `${t("apply.until")} ${fmt(c.closesAt)}`}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

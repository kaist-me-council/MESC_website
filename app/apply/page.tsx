"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { Ticket, ChevronRight, Shirt, ClipboardCheck, AlertTriangle } from "lucide-react";
import { errText, request, type ReqFail } from "./[slug]/types";

interface CampaignSummary {
  slug: string;
  title: string;
  titleEn: string | null;
  kind?: "goods" | "signup";
  imageUrl?: string | null;
  open: boolean;
  opensAt: string | null;
  closesAt: string | null;
  confirmOpen?: boolean;
}

export default function ApplyListPage() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<CampaignSummary[] | null>(null);
  const [fail, setFail] = useState<ReqFail | null>(null);

  const load = useCallback(async () => {
    const r = await request<{ campaigns: CampaignSummary[] }>("/api/campaigns");
    if (r.ok) { setItems(r.data.campaigns ?? []); setFail(null); }
    else { setItems(null); setFail(r); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const status = (c: CampaignSummary) => {
    if (c.open) return { label: t("apply.open"), variant: "default" as const };
    if (c.opensAt && new Date(c.opensAt) > new Date()) return { label: t("apply.notOpenYet"), variant: "secondary" as const };
    return { label: t("apply.closed"), variant: "outline" as const };
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2 [text-wrap:balance]"><Ticket className="h-7 w-7 text-primary" />{t("apply.listTitle")}</h1>
      <p className="text-muted-foreground mb-8 [text-wrap:pretty]">{t("apply.listSubtitle")}</p>

      {fail && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span className="flex-1">{errText(fail, t)}</span>
            <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => Promise.resolve().then(load)}>{t("apply.retry")}</Button>
          </AlertDescription>
        </Alert>
      )}
      {items === null && !fail && (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted" />)}
        </div>
      )}
      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          <Ticket className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" strokeWidth={1.25} />
          {t("apply.listEmpty")}
        </div>
      )}

      <div className="space-y-3">
        {items?.map((c, i) => {
          const s = status(c);
          const goods = c.kind === "goods";
          return (
            <Link key={c.slug} href={`/apply/${c.slug}`} className="block animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 70}ms` }}>
              <Card className="rounded-2xl border-border/60 shadow-lg shadow-primary/5 hover-lift-premium">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10 grid place-items-center bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5">
                    {goods && c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : goods ? (
                      <Shirt className="h-7 w-7 text-primary/60" strokeWidth={1.25} />
                    ) : (
                      <Ticket className="h-7 w-7 text-primary/60" strokeWidth={1.25} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                      {c.kind && <Badge variant="outline" className="text-xs">{t(`apply.kind_${c.kind}`)}</Badge>}
                      {c.confirmOpen && <Badge variant="secondary" className="text-xs gap-1"><ClipboardCheck className="h-3 w-3" />{t("apply.confirmOpenBadge")}</Badge>}
                    </div>
                    <p className="font-semibold truncate">{lang === "en" && c.titleEn ? c.titleEn : c.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
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

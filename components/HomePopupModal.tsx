"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface PopupLink {
  id: number;
  label: string;
  labelEn: string | null;
  url: string;
  icon: string | null;
}

interface PopupData {
  enabled: boolean;
  title: string;
  message: string | null;
  links: PopupLink[];
}

const DISMISS_KEY = "mesc_popup_dismissed_at";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24시간

export default function HomePopupModal() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PopupData | null>(null);

  useEffect(() => {
    // 24시간 dismiss 체크
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) return;

    fetch("/api/popup")
      .then((res) => res.json())
      .then((d: PopupData) => {
        if (!d.enabled || d.links.length === 0) return;
        setData(d);
        // 살짝 delay 후 모달 표시 (페이지 로딩 완료 후)
        setTimeout(() => setOpen(true), 600);
      })
      .catch(() => {});
  }, []);

  function handleDismissToday() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{data.title}</DialogTitle>
          {data.message && (
            <DialogDescription className="whitespace-pre-line">
              {data.message}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {data.links.map((link) => {
            const label = lang === "en" && link.labelEn ? link.labelEn : link.label;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-primary/10 hover:border-primary/40 transition-all group"
              >
                {link.icon && <span className="text-2xl shrink-0">{link.icon}</span>}
                <span className="font-semibold flex-1 text-sm">{label}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </a>
            );
          })}
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={handleDismissToday}>
            {lang === "ko" ? "오늘 그만 보기" : "Don't show today"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {lang === "ko" ? "닫기" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

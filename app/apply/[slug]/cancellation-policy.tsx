import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { fill, localeOf, type RefundTier, type T } from "./types";

type Policy = { cancelDeadline?: string | null; refundPolicy?: RefundTier[] };

export function CancellationPolicy({ policy, t, lang, compact = false }: { policy: Policy; t: T; lang: string; compact?: boolean }) {
  const tiers = [...(policy.refundPolicy ?? [])].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  const fmt = (iso: string) => new Date(iso).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" });
  const note = (tier: RefundTier) => lang === "en" ? tier.noteEn || tier.note : tier.note;

  return (
    <div className={`rounded-xl border border-border/60 ${compact ? "p-3" : "p-4"} text-sm`}>
      <p className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 shrink-0 text-primary" />{t("apply.cancellationPolicyTitle")}</p>
      <div className="mt-2 space-y-2 text-muted-foreground [text-wrap:pretty]">
        <p>{policy.cancelDeadline ? fill(t("apply.cancellationDeadline"), fmt(policy.cancelDeadline)) : t("apply.cancellationPolicyAuto")}</p>
        {tiers.length > 0 ? (
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">{t("apply.refundSchedule")}</p>
            {policy.cancelDeadline && <p className="text-xs">{t("apply.refundContact")}</p>}
            <ul className="space-y-1">
              {tiers.map((tier, index) => <li key={`${tier.deadline}-${index}`} className="flex flex-wrap justify-between gap-x-3 rounded-lg bg-muted/40 px-3 py-2">
                <span>{fill(t("apply.refundBy"), fmt(tier.deadline))}{note(tier) ? ` · ${note(tier)}` : ""}</span>
                <strong className="text-foreground tabular-nums">{tier.refundPercent === 0 ? t("apply.refundNone") : fill(t("apply.refundPercent"), tier.refundPercent)}</strong>
              </li>)}
            </ul>
            <p className="text-xs">{t("apply.refundAfterDeadline")}</p>
          </div>
        ) : <p>{t("apply.cancellationPolicyAfterPaid")}</p>}
        <p className="text-xs">{t("apply.statutoryRights")} <Link href="/terms#cancellation-refunds" className="text-primary underline underline-offset-2">{t("apply.cancellationPolicyTerms")}</Link></p>
      </div>
    </div>
  );
}

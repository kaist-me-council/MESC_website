"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { CheckCircle2, AlertTriangle, Lock, Minus, Plus, Landmark } from "lucide-react";

const AFFILIATIONS = ["학부생", "대학원생", "교수님", "졸업생", "기타"] as const;
type Affiliation = (typeof AFFILIATIONS)[number];

interface Option { id: number; group: string | null; name: string; nameEn: string | null; price: number; remaining: number | null }
interface Campaign {
  slug: string; title: string; titleEn: string | null; description: string | null; descriptionEn: string | null;
  open: boolean; opensAt: string | null; closesAt: string | null; afterNote: string | null; afterNoteEn: string | null;
  allowQty: boolean; maxPerPerson: number | null; requireStudentId: boolean; priceAdjust: Record<string, number>; options: Option[];
}
interface OrderItem { optionId: number; group: string | null; name: string; qty: number; unitPrice: number }
interface Order {
  orderNo: string; status: "pending" | "paid" | "delivered" | "cancelled"; items: OrderItem[]; total: number; createdAt: string;
  affiliation: string; name: string; bankInfo?: string | null; afterNote?: string | null; afterNoteEn?: string | null;
}

const fill = (s: string, n: string | number) => s.replace("{n}", String(n));

export default function ApplyCampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [affiliation, setAffiliation] = useState<Affiliation>("학부생");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(() => {
    fetch(`/api/campaigns/${slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCampaign(d?.campaign ?? null))
      .catch(() => setCampaign(null));
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const won = (n: number) => fill(t("apply.won"), n.toLocaleString());
  const optName = (o: Option) => (lang === "en" && o.nameEn ? o.nameEn : o.name);
  const adjust = campaign?.priceAdjust?.[affiliation] ?? 0;
  const unit = (o: Option) => o.price + adjust;
  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);
  const total = campaign ? campaign.options.reduce((sum, o) => sum + (qty[o.id] ?? 0) * unit(o), 0) : 0;
  const hasAdjust = campaign ? Object.values(campaign.priceAdjust ?? {}).some((v) => v) : false;

  function setQ(o: Option, n: number) {
    const cap = o.remaining === null ? Infinity : o.remaining;
    const maxTotal = campaign?.maxPerPerson ?? Infinity;
    const others = totalQty - (qty[o.id] ?? 0);
    const v = Math.max(0, Math.min(n, cap, maxTotal - others, campaign?.allowQty ? Infinity : 1));
    setQty({ ...qty, [o.id]: v });
  }

  async function submit() {
    if (!campaign) return;
    const items = campaign.options.filter((o) => (qty[o.id] ?? 0) > 0).map((o) => ({ optionId: o.id, qty: qty[o.id] }));
    if (!items.length) { setError(t("apply.selectError")); return; }
    if (!name.trim() || !email.trim() || (campaign.requireStudentId && !studentId.trim())) { setError(t("apply.formError")); return; }
    setSubmitting(true); setError("");
    const res = await fetch(`/api/campaigns/${slug}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliation, name: name.trim(), studentId: studentId.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined, items }),
    });
    const d = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.status === 409 && d.optionId) {
      const o = campaign.options.find((x) => x.id === d.optionId);
      setError(fill(t("apply.stockError"), o ? optName(o) : "?"));
      load();
      return;
    }
    if (!res.ok) { setError(d.error ?? t("apply.genericError")); return; }
    setOrder(d.order);
    setQty({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (campaign === undefined) return <div className="container mx-auto px-4 py-8 max-w-lg text-sm text-muted-foreground">{t("apply.loading")}</div>;
  if (campaign === null) return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <p className="text-muted-foreground mb-4">{t("apply.notFound")}</p>
      <Link href="/apply" className="text-primary underline text-sm">{t("apply.back")}</Link>
    </div>
  );

  const title = lang === "en" && campaign.titleEn ? campaign.titleEn : campaign.title;
  const description = lang === "en" && campaign.descriptionEn ? campaign.descriptionEn : campaign.description;
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const groups = [...new Set(campaign.options.map((o) => o.group ?? ""))];

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Link href="/apply" className="text-sm text-muted-foreground hover:text-foreground">← {t("apply.back")}</Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">{title}</h1>
      <div className="flex items-center gap-2 mb-4">
        <Badge variant={campaign.open ? "default" : "outline"}>{campaign.open ? t("apply.open") : t("apply.closed")}</Badge>
        {campaign.closesAt && <span className="text-xs text-muted-foreground">{t("apply.until")} {fmt(campaign.closesAt)}</span>}
      </div>
      {description && <p className="text-muted-foreground whitespace-pre-line mb-6">{description}</p>}

      {order && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />{t("apply.doneTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted/40 p-4 text-center">
              <p className="text-xs text-muted-foreground">{t("apply.orderNo")}</p>
              <p className="text-2xl font-bold tracking-wider">{order.orderNo}</p>
            </div>
            <ul className="text-sm space-y-1">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between"><span>{i.group ? `${i.group} · ` : ""}{i.name} × {i.qty}</span><span>{won(i.unitPrice * i.qty)}</span></li>
              ))}
              <li className="flex justify-between font-bold border-t pt-1"><span>{t("apply.total")}</span><span>{won(order.total)}</span></li>
            </ul>
            {order.total > 0 && order.bankInfo && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium flex items-center gap-1.5 mb-1"><Landmark className="h-4 w-4" />{t("apply.bank")}</p>
                <p className="whitespace-pre-line select-all">{order.bankInfo}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("apply.bankHint")}</p>
              </div>
            )}
            {(lang === "en" && order.afterNoteEn ? order.afterNoteEn : order.afterNote) && (
              <p className="text-sm whitespace-pre-line">{lang === "en" && order.afterNoteEn ? order.afterNoteEn : order.afterNote}</p>
            )}
            <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>{t("apply.screenshot")}</AlertDescription></Alert>
            <Button variant="outline" className="w-full" onClick={() => setOrder(null)}>{t("apply.newOrder")}</Button>
          </CardContent>
        </Card>
      )}

      {!order && !campaign.open && (
        <Alert className="mb-6"><Lock className="h-4 w-4" /><AlertDescription>{t("apply.closedNote")}</AlertDescription></Alert>
      )}

      {!order && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("apply.options")}</CardTitle>
            {campaign.maxPerPerson && <CardDescription>{fill(t("apply.maxPerPerson"), campaign.maxPerPerson)}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {groups.map((g) => (
              <div key={g} className="space-y-1.5">
                {g && <p className="text-sm font-semibold">{g}</p>}
                {campaign.options.filter((o) => (o.group ?? "") === g).map((o) => {
                  const q = qty[o.id] ?? 0;
                  const out = o.remaining !== null && o.remaining <= 0;
                  return (
                    <div key={o.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${out ? "opacity-50" : ""}`}>
                      <div className="min-w-0">
                        <span className="font-medium">{optName(o)}</span>
                        <span className="ml-2 text-muted-foreground">{unit(o) === 0 ? t("apply.free") : won(unit(o))}</span>
                        <div className="text-xs text-muted-foreground">
                          {out ? t("apply.soldOut") : o.remaining === null ? t("apply.unlimited") : fill(t("apply.remaining"), o.remaining)}
                        </div>
                      </div>
                      {campaign.allowQty ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!campaign.open || q === 0} onClick={() => setQ(o, q - 1)} aria-label="-"><Minus className="h-4 w-4" /></Button>
                          <span className="w-6 text-center tabular-nums">{q}</span>
                          <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!campaign.open || out} onClick={() => setQ(o, q + 1)} aria-label="+"><Plus className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant={q ? "default" : "outline"} disabled={!campaign.open || out} onClick={() => setQ(o, q ? 0 : 1)}>{q ? "✓" : "+"}</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {hasAdjust && <p className="text-xs text-muted-foreground">{t("apply.priceAdjustNote")}</p>}
          </CardContent>
        </Card>
      )}

      {!order && (
        <Card className="mb-6">
          <CardHeader><CardTitle>{t("apply.applicant")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aff">{t("apply.affiliation")}</Label>
              <select id="aff" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={affiliation} disabled={!campaign.open} onChange={(e) => setAffiliation(e.target.value as Affiliation)}>
                {AFFILIATIONS.map((a) => <option key={a} value={a}>{t(`apply.aff_${a}`)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("apply.name")}</Label>
              <Input id="name" value={name} disabled={!campaign.open} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sid">{campaign.requireStudentId ? t("apply.studentId") : t("apply.studentIdOptional")}</Label>
              <Input id="sid" inputMode="numeric" value={studentId} disabled={!campaign.open} onChange={(e) => setStudentId(e.target.value)} placeholder="20250001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("apply.email")}</Label>
              <Input id="email" type="email" value={email} disabled={!campaign.open} onChange={(e) => setEmail(e.target.value)} placeholder="id@kaist.ac.kr" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("apply.phoneOptional")}</Label>
              <Input id="phone" type="tel" value={phone} disabled={!campaign.open} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">{t("apply.note")}</Label>
              <Textarea id="note" rows={2} value={note} disabled={!campaign.open} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">{t("apply.total")}</span>
              <span className="text-lg font-bold">{won(total)}</span>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={!campaign.open || submitting} className="w-full">{submitting ? t("apply.submitting") : t("apply.submit")}</Button>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("apply.privacyNote")}</p>
          </CardContent>
        </Card>
      )}

      <Lookup slug={slug} requireStudentId={campaign.requireStudentId} t={t} lang={lang} won={won} />
    </div>
  );
}

function Lookup({ slug, requireStudentId, t, lang, won }: { slug: string; requireStudentId: boolean; t: (k: string) => string; lang: string; won: (n: number) => string }) {
  const [openPanel, setOpenPanel] = useState(false);
  const [mode, setMode] = useState<"student" | "email">(requireStudentId ? "student" : "email");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);

  async function lookup() {
    if (!name.trim() || !key.trim()) return;
    setLoading(true); setOrders(null);
    const res = await fetch(`/api/campaigns/${slug}/lookup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), ...(mode === "student" ? { studentId: key.trim() } : { email: key.trim() }) }),
    });
    const d = await res.json().catch(() => ({ orders: [] }));
    setLoading(false);
    setOrders(d.orders ?? []);
  }

  const statusVariant = (s: Order["status"]) => (s === "paid" || s === "delivered" ? "default" : s === "cancelled" ? "destructive" : "secondary");

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpenPanel(!openPanel)}>
        <CardTitle className="text-base flex items-center justify-between">{t("apply.lookupTitle")}<span className="text-muted-foreground">{openPanel ? "−" : "+"}</span></CardTitle>
        {openPanel && <CardDescription>{t("apply.lookupDesc")}</CardDescription>}
      </CardHeader>
      {openPanel && (
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "student" ? "default" : "outline"} onClick={() => setMode("student")}>{t("apply.byStudentId")}</Button>
            <Button type="button" size="sm" variant={mode === "email" ? "default" : "outline"} onClick={() => setMode("email")}>{t("apply.byEmail")}</Button>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("apply.name")} />
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={mode === "student" ? t("apply.studentId") : t("apply.email")} inputMode={mode === "student" ? "numeric" : "email"} onKeyDown={(e) => e.key === "Enter" && lookup()} />
          <Button variant="outline" className="w-full" disabled={loading} onClick={lookup}>{loading ? t("apply.loading") : t("apply.lookupButton")}</Button>
          {orders && orders.length === 0 && <p className="text-sm text-muted-foreground">{t("apply.lookupEmpty")}</p>}
          {orders?.map((o) => (
            <div key={o.orderNo} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold tracking-wider">{o.orderNo}</span>
                <Badge variant={statusVariant(o.status)}>{t(`apply.status_${o.status}`)}</Badge>
              </div>
              <ul className="text-muted-foreground">
                {o.items.map((i, idx) => <li key={idx}>{i.group ? `${i.group} · ` : ""}{i.name} × {i.qty}</li>)}
              </ul>
              <div className="flex justify-between"><span>{t("apply.total")}</span><span className="font-medium">{won(o.total)}</span></div>
              {o.status === "pending" && o.total > 0 && o.bankInfo && <p className="text-xs whitespace-pre-line select-all">{t("apply.bank")}: {o.bankInfo}</p>}
              <p className="text-xs text-muted-foreground">{t("apply.appliedAt")}: {new Date(o.createdAt).toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

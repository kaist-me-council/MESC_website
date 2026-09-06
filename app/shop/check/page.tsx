"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { CheckCircle2, PackageX, Lock, AlertTriangle } from "lucide-react";

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;
type Choice = "pickup" | "refund" | "exchange";
interface Item { color: "white" | "black"; size: string; qty: number }
interface Resolution extends Item { choice: Choice; exchangeSize?: string }
interface Record_ {
  id: number; affiliation: string; name: string; items: Item[]; pickedUp: boolean; memo: string | null;
  response: "received" | "not_received" | null; resolution: Resolution[] | null; responseNote: string | null;
  respondedAt: string | null; deadline: string; deadlinePassed: boolean;
}

export default function ShopCheckPage() {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<"student" | "email">("student");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<Record_[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  const cred = () => ({ name: name.trim(), ...(mode === "student" ? { studentId: studentId.trim() } : { email: email.trim() }) });

  async function lookup() {
    if (!name.trim() || (mode === "student" ? !studentId.trim() : !email.trim())) { setError(t("shopCheck.enterError")); return; }
    setLoading(true); setError(""); setRecords(null); setNotFound(false);
    const res = await fetch("/api/shop/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cred()) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? t("shopCheck.genericError")); return; }
    if (!data.found) { setNotFound(true); return; }
    setRecords(data.records);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <h1 className="text-3xl font-bold mb-2">{t("shopCheck.title")}</h1>
      <p className="text-muted-foreground mb-6">{t("shopCheck.subtitle")}</p>

      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{t("shopCheck.deadlineNote")}</AlertDescription>
      </Alert>

      {!records && (
        <Card>
          <CardHeader>
            <CardTitle>{t("shopCheck.queryTitle")}</CardTitle>
            <CardDescription>{t("shopCheck.queryDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 text-sm">
              <Button type="button" size="sm" variant={mode === "student" ? "default" : "outline"} onClick={() => setMode("student")}>{t("shopCheck.modeStudent")}</Button>
              <Button type="button" size="sm" variant={mode === "email" ? "default" : "outline"} onClick={() => setMode("email")}>{t("shopCheck.modeEmail")}</Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("shopCheck.name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("shopCheck.namePlaceholder")} autoComplete="name" />
            </div>
            {mode === "student" ? (
              <div className="space-y-2">
                <Label htmlFor="sid">{t("shopCheck.studentId")}</Label>
                <Input id="sid" inputMode="numeric" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="20250001" onKeyDown={(e) => e.key === "Enter" && lookup()} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">{t("shopCheck.email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="id@kaist.ac.kr" onKeyDown={(e) => e.key === "Enter" && lookup()} />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={lookup} disabled={loading} className="w-full">{loading ? t("shopCheck.checking") : t("shopCheck.checkButton")}</Button>
            {notFound && (
              <Alert variant="destructive">
                <PackageX className="h-4 w-4" />
                <AlertDescription>{t("shopCheck.notFound")}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("shopCheck.privacyNote")}</p>
          </CardContent>
        </Card>
      )}

      {records && (
        <div className="space-y-4">
          {records.map((r) => (
            <RecordCard key={r.id} record={r} cred={cred()} onSaved={(u) => setRecords(records.map((x) => (x.id === u.id ? u : x)))} t={t} lang={lang} />
          ))}
          <Button variant="ghost" className="w-full" onClick={() => setRecords(null)}>{t("shopCheck.back")}</Button>
        </div>
      )}
    </div>
  );
}

function RecordCard({ record, cred, onSaved, t, lang }: {
  record: Record_; cred: object; onSaved: (r: Record_) => void; t: (k: string) => string; lang: string;
}) {
  const [response, setResponse] = useState<"received" | "not_received" | null>(record.response);
  const [resolution, setResolution] = useState<Resolution[]>(
    record.resolution ?? record.items.map((i) => ({ ...i, choice: "pickup" as Choice })),
  );
  const [note, setNote] = useState(record.responseNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const colorLabel = (c: string) => (c === "white" ? t("shopCheck.white") : t("shopCheck.black"));
  const locked = record.deadlinePassed;

  async function submit() {
    if (!response) return;
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/shop/check", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cred, id: record.id, response, resolution: response === "not_received" ? resolution : undefined, note }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.found) { setError(data.error ?? t("shopCheck.genericError")); return; }
    setSaved(true); onSaved(data.record);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{record.name} <span className="text-sm font-normal text-muted-foreground">({record.affiliation})</span></span>
          {record.response && <Badge variant={record.response === "received" ? "secondary" : "destructive"}>{record.response === "received" ? t("shopCheck.received") : t("shopCheck.notReceived")}</Badge>}
        </CardTitle>
        <CardDescription>{t("shopCheck.orderTitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-1">
          {record.items.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{colorLabel(i.color)} · <strong>{i.size}</strong></span>
              <span className="text-muted-foreground">× {i.qty}</span>
            </li>
          ))}
          {record.items.length === 0 && <li className="text-sm text-muted-foreground">{t("shopCheck.noItems")}</li>}
        </ul>
        {record.memo && <p className="text-xs text-muted-foreground">📝 {record.memo}</p>}
        <p className="text-xs text-muted-foreground">{record.pickedUp ? t("shopCheck.recordPicked") : t("shopCheck.recordNotPicked")}</p>

        <div className="space-y-2">
          <Label>{t("shopCheck.question")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={response === "received" ? "default" : "outline"} disabled={locked} onClick={() => setResponse("received")} className="h-12">
              <CheckCircle2 className="h-4 w-4 mr-1" />{t("shopCheck.received")}
            </Button>
            <Button type="button" variant={response === "not_received" ? "destructive" : "outline"} disabled={locked} onClick={() => setResponse("not_received")} className="h-12">
              <PackageX className="h-4 w-4 mr-1" />{t("shopCheck.notReceived")}
            </Button>
          </div>
        </div>

        {response === "not_received" && (
          <div className="space-y-3 rounded-md bg-muted/40 p-3">
            <p className="text-sm">{t("shopCheck.resolutionHelp")}</p>
            {resolution.map((r, idx) => (
              <div key={idx} className="space-y-1.5">
                <p className="text-sm font-medium">{colorLabel(r.color)} {r.size} × {r.qty}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["pickup", "refund", "exchange"] as Choice[]).map((c) => (
                    <Button key={c} type="button" size="sm" disabled={locked} variant={r.choice === c ? "default" : "outline"}
                      onClick={() => setResolution(resolution.map((x, i) => (i === idx ? { ...x, choice: c, exchangeSize: c === "exchange" ? x.exchangeSize ?? x.size : undefined } : x)))}>
                      {t(`shopCheck.choice_${c}`)}
                    </Button>
                  ))}
                  {r.choice === "exchange" && (
                    <select className="h-8 rounded-md border bg-background px-2 text-sm" disabled={locked} value={r.exchangeSize ?? r.size}
                      onChange={(e) => setResolution(resolution.map((x, i) => (i === idx ? { ...x, exchangeSize: e.target.value } : x)))}>
                      {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("shopCheck.refundNote")}</p>
          </div>
        )}

        {response && (
          <div className="space-y-2">
            <Label htmlFor={`note-${record.id}`}>{t("shopCheck.note")}</Label>
            <Textarea id={`note-${record.id}`} rows={2} value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder={t("shopCheck.notePlaceholder")} />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {locked ? (
          <p className="text-sm text-muted-foreground">{t("shopCheck.closed")}</p>
        ) : (
          <Button onClick={submit} disabled={!response || saving} className="w-full">{saving ? t("shopCheck.saving") : record.response ? t("shopCheck.update") : t("shopCheck.submit")}</Button>
        )}
        {saved && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{response === "received" ? t("shopCheck.savedReceived") : t("shopCheck.savedNotReceived")}</AlertDescription>
          </Alert>
        )}
        {record.respondedAt && !saved && (
          <p className="text-xs text-muted-foreground">{t("shopCheck.respondedAt")}: {new Date(record.respondedAt).toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}</p>
        )}
      </CardContent>
    </Card>
  );
}

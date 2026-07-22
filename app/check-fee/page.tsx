"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { CheckCircle2, XCircle, AlertTriangle, Lock } from "lucide-react";

export default function CheckFeePage() {
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<{ found: boolean; count: number } | null>(null);
  // count는 소수점 포함 가능 (e.g. 1.5)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  async function handleCheck() {
    if (!studentId.trim()) {
      setError(t("checkFee.enterIdError"));
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch(`/api/check-fee?id=${encodeURIComponent(studentId.trim())}`);
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("checkFee.genericError"));
    } else {
      setResult(data);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <h1 className="text-3xl font-bold mb-2">{t("checkFee.title")}</h1>
      <p className="text-muted-foreground mb-8">{t("checkFee.subtitle")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("checkFee.queryTitle")}</CardTitle>
          <CardDescription>{t("checkFee.queryDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studentId">{t("checkFee.studentId")}</Label>
            <Input
              id="studentId"
              placeholder={t("checkFee.placeholder")}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            />
          </div>
          <Button onClick={handleCheck} disabled={loading} className="w-full">
            {loading ? t("checkFee.checking") : t("checkFee.checkButton")}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div
              className={`rounded-lg p-6 text-center border-2 ${
                !result.found
                  ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950"
                  : result.count >= 2
                  ? "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950"
                  : result.count === 1
                  ? "border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950"
                  : "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950"
              }`}
            >
              {!result.found ? (
                <>
                  <XCircle className="h-10 w-10 mx-auto mb-2 text-red-600 dark:text-red-400" />
                  <p className="text-lg font-semibold">{t("checkFee.notFound")}</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {t("checkFee.notFoundDesc")}
                  </p>
                </>
              ) : result.count >= 2 ? (
                <>
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p className="text-lg font-semibold">
                    {t("checkFee.paidCount")}:{" "}
                    <span className="text-2xl font-bold">{result.count}{t("checkFee.timesUnit")}</span>
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {t("checkFee.fullyPaid")}
                  </p>
                </>
              ) : result.count > 0 ? (
                <>
                  <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-lg font-semibold">
                    {t("checkFee.paidCount")}:{" "}
                    <span className="text-2xl font-bold">{result.count}{t("checkFee.timesUnit")}</span>
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {t("checkFee.partialPaid")}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-10 w-10 mx-auto mb-2 text-red-600 dark:text-red-400" />
                  <p className="text-lg font-semibold">{t("checkFee.paidCount")}: <span className="text-2xl font-bold">0{t("checkFee.timesUnit")}</span></p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {t("checkFee.notPaid")}
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
        <Lock className="h-3.5 w-3.5" /> {t("checkFee.privacyNote")}
      </p>
    </div>
  );
}

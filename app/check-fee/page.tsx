"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";

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
      setError(data.error ?? "오류가 발생했습니다.");
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
                  ? "border-red-300 bg-red-50 dark:bg-red-950"
                  : result.count >= 2
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : result.count === 1
                  ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                  : "border-red-400 bg-red-50 dark:bg-red-950"
              }`}
            >
              {!result.found ? (
                <>
                  <div className="text-4xl mb-2">❌</div>
                  <p className="text-lg font-semibold">{t("checkFee.notFound")}</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {t("checkFee.notFoundDesc")}
                  </p>
                </>
              ) : result.count >= 2 ? (
                <>
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-lg font-semibold">
                    {t("checkFee.paidCount")}:{" "}
                    <span className="text-2xl font-bold">{result.count}회</span>
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {t("checkFee.fullyPaid")}
                  </p>
                </>
              ) : result.count > 0 ? (
                <>
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="text-lg font-semibold">
                    {t("checkFee.paidCount")}:{" "}
                    <span className="text-2xl font-bold">{result.count}회</span>
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {t("checkFee.partialPaid")}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">❌</div>
                  <p className="text-lg font-semibold">{t("checkFee.paidCount")}: <span className="text-2xl font-bold">0회</span></p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {t("checkFee.notPaid")}
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-4">
        🔒 {t("checkFee.privacyNote")}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/language-context";
import { CheckCircle2, XCircle, AlertTriangle, Lock, SearchX } from "lucide-react";

// 통신 실패 유형별 안내. i18n 파일을 다른 작업과 동시에 건드리지 않으려고 이 화면에 둔다.
const FAIL_TEXT = {
  ko: {
    network: "연결에 실패했습니다. 인터넷 상태를 확인하고 다시 시도해주세요.",
    ratelimit: "조회가 너무 잦습니다. 잠시 후 다시 시도해주세요.",
    server: "서버에 문제가 있습니다. 잠시 후 다시 시도해주세요.",
  },
  en: {
    network: "Connection failed. Check your network and try again.",
    ratelimit: "Too many lookups. Please wait a moment and try again.",
    server: "Server error. Please try again shortly.",
  },
} as const;

export default function CheckFeePage() {
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<{ found: boolean; count: number } | null>(null);
  // count는 소수점 포함 가능 (e.g. 1.5)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t, lang } = useLanguage();

  async function handleCheck() {
    if (!studentId.trim()) {
      setError(t("checkFee.enterIdError"));
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const fail = FAIL_TEXT[lang === "en" ? "en" : "ko"];

    // 학번은 본문으로만 보낸다 (URL·기록에 남기지 않음). 실패해도 입력값은 그대로 두고 버튼을 푼다.
    try {
      const res = await fetch("/api/check-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResult(data);
      } else if (res.status === 429) {
        setError(data.error ?? fail.ratelimit);
      } else if (res.status >= 500) {
        setError(fail.server);
      } else {
        setError(data.error ?? t("checkFee.genericError"));
      }
    } catch {
      setError(fail.network);
    } finally {
      setLoading(false);
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
                // 명단에 없음 = 미납이 아니라 "조회 불가". 미납(빨강)과 색을 나눠
                // 문구를 읽지 않아도 다른 상황임이 보이게 한다.
                !result.found
                  ? "border-border bg-muted/50"
                  : result.count >= 2
                  ? "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950"
                  // 본문과 같은 조건이어야 한다. 시트에 0.5·1.5 같은 값이 실제로
                  // 있어서 === 1 로 두면 "일부 납부" 문구에 빨간 테두리가 붙는다.
                  : result.count > 0
                  ? "border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950"
                  : "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950"
              }`}
            >
              {!result.found ? (
                <>
                  <SearchX className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-lg font-semibold">{t("checkFee.notFound")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
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

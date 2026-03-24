"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Wallet,
  Info,
  FileSpreadsheet,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

const EMBED_URL = process.env.NEXT_PUBLIC_BUDGET_SHEET_EMBED_URL ?? "";

interface BudgetSummary {
  income: number;
  expense: number;
  balance: number;
  monthlyData: { month: string; income: number; expense: number }[];
}

function formatKRW(amount: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);
}

function calculatePercentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

export default function BudgetPage() {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setLoading(true);
    fetch("/api/budget-summary")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSummary(data);
      })
      .catch(() => setError(t("budget.dataUnavailable")))
      .finally(() => setLoading(false));
  }, []);

  const hasEmbed = EMBED_URL.length > 0;
  const hasData = summary && (summary.income > 0 || summary.expense > 0);
  const expensePercentage = hasData ? calculatePercentage(summary.expense, summary.income) : 0;
  const summaryLoaded = !loading && summary !== null && !error;

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-muted/40 to-muted/20 border-b border-border/40 py-16 md:py-24">
        <div className="absolute inset-0 tech-mesh opacity-20 -z-10" />
        <div className="container mx-auto px-4">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider uppercase border border-primary/20">
              <PieChart className="h-3.5 w-3.5" />
              <span>{t("budget.badge")}</span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">{t("budget.title")}</h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                {t("budget.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        {/* Summary Cards */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Income Card */}
            <Card className="stat-card border-l-4 border-l-green-500 hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  {t("budget.totalIncome")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-black tracking-tight text-green-600 dark:text-green-400">
                  {formatKRW(summary.income)}
                </p>
                <div className="pt-2 text-xs text-muted-foreground font-medium">
                  {t("budget.income")}
                </div>
              </CardContent>
            </Card>

            {/* Expense Card */}
            <Card className="stat-card border-l-4 border-l-red-500 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  {t("budget.totalExpense")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-black tracking-tight text-red-600 dark:text-red-400">
                  {formatKRW(summary.expense)}
                </p>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">{t("budget.expenseRate")}</span>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">{expensePercentage}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Balance Card */}
            <Card className={`stat-card border-l-4 ${summary.balance >= 0 ? "border-l-primary hover:shadow-2xl hover:shadow-primary/10" : "border-l-orange-500 hover:shadow-2xl hover:shadow-orange-500/10"} transition-all duration-300 group`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" style={{ color: summary.balance >= 0 ? "var(--color-primary)" : "#f97316" }} />
                  {t("budget.currentBalance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className={`text-3xl font-black tracking-tight ${summary.balance >= 0 ? "text-primary" : "text-orange-600 dark:text-orange-400"}`}>
                  {formatKRW(summary.balance)}
                </p>
                <div className="pt-2 flex items-center gap-2">
                  {summary.balance >= 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400 font-bold">{t("budget.healthyFinance")}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-bold">{t("budget.deficit")}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Chart */}
        {hasData && summary.monthlyData.length > 0 && (
          <Card className="mb-12 border-border/60 shadow-lg shadow-primary/5 overflow-hidden rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-muted/40 to-muted/20 border-b border-border/40 pb-6">
              <div className="space-y-2">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t("budget.monthlyFlow")}
                </CardTitle>
                <CardDescription className="font-medium">
                  {t("budget.monthlyFlowDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-8 pb-6">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.9 0.03 240 / 0.2)" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(v) => `${Math.round(v / 10000)}만`}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                      }}
                      formatter={(value) => [formatKRW(Number(value)), ""]}
                      labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: "20px", fontWeight: 600 }} />
                    <Bar dataKey="income" name={t("budget.income")} fill="oklch(0.6 0.15 140)" radius={[8, 8, 0, 0]} barSize={36} />
                    <Bar dataKey="expense" name={t("budget.expense")} fill="oklch(0.6 0.2 25)" radius={[8, 8, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-muted-foreground font-medium">
            {t("notices.loading")}
          </div>
        )}

        {/* 데이터가 0원일 때 안내 */}
        {summaryLoaded && !hasData && (
          <div className="mb-10 flex items-start gap-3 text-sm bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-bold text-amber-700 dark:text-amber-300">예산 데이터를 파싱하지 못했습니다</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                CSV 시트의 헤더 행에 <code className="bg-muted px-1 rounded font-bold">수입</code> 또는{" "}
                <code className="bg-muted px-1 rounded font-bold">지출</code> 컬럼이 있는지 확인해주세요.
                (현재 시트 형식: 사업일 / 담당자 / 집행내용 / 코드 / 거래형태 / 수입 / 지출 / 잔액)
              </p>
            </div>
          </div>
        )}

        {/* Detailed Sheet Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
              <div>
                <h2 className="text-2xl font-black tracking-tight">{t("budget.detailedStatement")}</h2>
                <p className="text-xs text-muted-foreground font-medium mt-1">{t("budget.allTransactions")}</p>
              </div>
            </div>
            {hasEmbed && (
              <a
                href={EMBED_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-primary hover:gap-2 flex items-center transition-all group"
              >
                {t("budget.fullScreen")}
                <ExternalLink className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
            )}
          </div>

          {hasEmbed ? (
            <div className="space-y-4">
              {iframeError ? (
                <Card className="border-border/60 rounded-2xl overflow-hidden">
                  <CardContent className="py-16 text-center flex flex-col items-center gap-4">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40" />
                    <div>
                      <p className="font-bold text-lg mb-1">임베드를 표시할 수 없습니다</p>
                      <p className="text-muted-foreground text-sm">구글 시트를 직접 열어서 확인하세요.</p>
                    </div>
                    <a
                      href={EMBED_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink className="h-4 w-4" />
                      구글 스프레드시트에서 전체 내역 보기
                    </a>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/60 shadow-2xl shadow-primary/5 overflow-hidden rounded-2xl">
                  <iframe
                    src={EMBED_URL}
                    className="w-full"
                    style={{ height: "750px", border: 0 }}
                    scrolling="yes"
                    onError={() => setIframeError(true)}
                    onLoad={(e) => {
                      // 구글 시트가 X-Frame-Options로 차단된 경우 감지 (빈 body)
                      try {
                        const iframe = e.currentTarget as HTMLIFrameElement;
                        if (iframe.contentDocument && iframe.contentDocument.body.innerHTML === "") {
                          setIframeError(true);
                        }
                      } catch {
                        // cross-origin 접근 불가 → 정상 로드된 것으로 간주
                      }
                    }}
                  />
                </Card>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3 text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/40 flex-1 mr-3">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary/60 font-bold" />
                  <p className="font-medium leading-relaxed">
                    위 내역은 구글 스프레드시트와 실시간 연동되어 관리자가 수정 시 즉시 업데이트됩니다.
                    지출 증빙 영수증 확인이 필요하신 경우 학생회실을 방문해 주시기 바랍니다.
                  </p>
                </div>
                <a
                  href={EMBED_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  새 탭으로 열기
                </a>
              </div>
            </div>
          ) : (
            <Card className="border-dashed border-2 border-border/40 bg-muted/10 rounded-2xl overflow-hidden">
              <CardContent className="py-20 text-center flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground/40">
                  <FileSpreadsheet className="h-10 w-10" />
                </div>
                <div className="max-w-md space-y-3">
                  <h3 className="text-2xl font-black">{t("budget.sheetSetup")}</h3>
                  <p className="text-muted-foreground font-medium">{t("budget.sheetSetupDesc")}</p>
                </div>
                <div className="bg-card border border-border/60 rounded-xl p-6 text-left text-sm max-w-lg w-full shadow-sm">
                  <p className="font-black mb-4 flex items-center gap-2 text-base">
                    <Settings className="h-4 w-4 text-primary" />
                    {t("budget.setupGuide")}
                  </p>
                  <ol className="space-y-3 text-muted-foreground list-decimal list-inside font-medium">
                    <li>Google Sheets 파일에서 <span className="text-foreground font-bold">파일 → 웹에 게시</span> 클릭</li>
                    <li>시트 탭을 선택하고 <span className="text-foreground font-bold">게시</span> 버튼 클릭</li>
                    <li>생성된 URL을 <code className="bg-muted px-2 py-1 rounded text-xs font-bold">NEXT_PUBLIC_BUDGET_SHEET_EMBED_URL</code> 환경 변수에 설정</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {error && (
          <div className="mt-8 p-5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 text-center text-sm font-bold flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

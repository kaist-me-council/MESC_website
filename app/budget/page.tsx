"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface Transaction {
  date: string;
  manager: string;
  description: string;
  category: string;
  income: number;
  expense: number;
  balance: number;
}

interface CategorySummary {
  name: string;
  budget: number;
  spent: number;
}

interface BudgetSummary {
  income: number;
  expense: number;
  balance: number;
  monthlyData: { month: string; income: number; expense: number }[];
  categories: CategorySummary[];
}

interface BudgetData {
  summary: BudgetSummary;
  transactions: Transaction[];
}

const EMBED_URL = process.env.NEXT_PUBLIC_BUDGET_SHEET_EMBED_URL ?? "";

function formatKRW(amount: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);
}

function calculatePercentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const match = dateStr.match(/(\d{4})[./\-](\d{2})[./\-](\d{2})/);
  if (match) {
    return `${match[2]}/${match[3]}`;
  }
  return dateStr;
}

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useLanguage();

  const itemsPerPage = 10;

  useEffect(() => {
    setLoading(true);
    fetch("/api/budget-summary")
      .then((r) => r.json())
      .then((result) => {
        if (result.error) setError(result.error);
        else setData(result);
      })
      .catch(() => setError(t("budget.dataUnavailable")))
      .finally(() => setLoading(false));
  }, [t]);

  const summary = data?.summary;
  const transactions = data?.transactions || [];
  const categories = summary?.categories || [];
  const hasData = summary && (summary.income > 0 || summary.expense > 0);
  const expensePercentage = hasData ? calculatePercentage(summary.expense, summary.income) : 0;

  // Pagination logic
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const currentTransactions = transactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

      <div className="container mx-auto px-4 py-16 space-y-16">
        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-muted-foreground font-medium">
{t("budget.loading")}
          </div>
        )}

        {!loading && (
          <>
            {/* 1. Summary Cards */}
            {hasData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="stat-card border-l-4 border-l-green-500 hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      {t("budget.totalIncome")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-3xl font-black tracking-tight tabular-nums text-green-600 dark:text-green-400">
                      {formatKRW(summary.income)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="stat-card border-l-4 border-l-red-500 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      {t("budget.totalExpense")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-3xl font-black tracking-tight tabular-nums text-red-600 dark:text-red-400">
                      {formatKRW(summary.expense)}
                    </p>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">{t("budget.expenseRate")}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">{expensePercentage}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`stat-card border-l-4 ${summary.balance >= 0 ? "border-l-primary hover:shadow-2xl hover:shadow-primary/10" : "border-l-orange-500 hover:shadow-2xl hover:shadow-orange-500/10"} transition-all duration-300`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <Wallet className={`h-4 w-4 ${summary.balance >= 0 ? "text-primary" : "text-orange-600 dark:text-orange-400"}`} />
                      {t("budget.currentBalance")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className={`text-3xl font-black tracking-tight tabular-nums ${summary.balance >= 0 ? "text-primary" : "text-orange-600 dark:text-orange-400"}`}>
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

            {/* 2. Original Data Sheet */}
            {EMBED_URL && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{t("budget.originalDataSheet")}</h2>
                    <p className="text-xs text-muted-foreground font-medium mt-1">{t("budget.originalDataSheetDesc")}</p>
                  </div>
                </div>
                <Card className="border-border/60 shadow-2xl overflow-hidden rounded-2xl">
                  <iframe
                    src={EMBED_URL}
                    className="w-full h-[70vh] sm:h-[600px] border-0"
                    scrolling="yes"
                  />
                </Card>
              </div>
            )}

            {/* 3. Category Breakdown */}
            {categories.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{t("budget.categoryBreakdown")}</h2>
                    <p className="text-xs text-muted-foreground font-medium mt-1">{t("budget.categoryBreakdownDesc")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat, idx) => {
                    const displayBudget = cat.budget || summary?.income || 0;
                    const percentage = calculatePercentage(cat.spent, displayBudget);
                    return (
                      <Card key={idx} className="border-border/50 bg-card/50">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-primary uppercase tracking-wider">{cat.name}</p>
                              <p className="text-lg font-black">{formatKRW(cat.spent)}</p>
                            </div>
                            <Layers className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                              <span>{t("budget.executionRate")}</span>
                              <span>{percentage}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(percentage, 100)}%` }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Detailed Transactions */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{t("budget.detailedStatement")}</h2>
                    <p className="text-xs text-muted-foreground font-medium mt-1">{t("budget.allTransactions")}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowDetails(!showDetails);
                    setCurrentPage(1);
                  }}
                  className="font-bold gap-2"
                >
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showDetails ? t("budget.hideDetails") : t("budget.viewDetails")}
                </Button>
              </div>

              {showDetails && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  {transactions.length === 0 ? (
                    <Card className="border-dashed border-2 bg-muted/10 rounded-2xl">
                      <CardContent className="py-16 text-center flex flex-col items-center gap-3">
                        <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">{t("budget.noTransactions")}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {currentTransactions.map((tx, idx) => (
                          <Card key={idx} className="border-border/50 bg-card/30">
                            <CardContent className="p-4 flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                                    {formatDate(tx.date)}
                                  </span>
                                  <p className="font-bold text-sm truncate text-foreground">{tx.description || t("common.transaction")}</p>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className="font-bold text-primary/70">{tx.category}</span>
                                  <span>•</span>
                                  <span className="font-medium">{tx.manager || t("common.executor")}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {tx.income > 0 && <p className="text-sm font-black tabular-nums text-green-600 dark:text-green-400">+{formatKRW(tx.income)}</p>}
                                {tx.expense > 0 && <p className="text-sm font-black tabular-nums text-red-600 dark:text-red-400">-{formatKRW(tx.expense)}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="font-bold"
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" /> {t("common.previous")}
                          </Button>
                          <span className="text-xs font-bold tabular-nums text-muted-foreground">
                            {currentPage} / {totalPages}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="font-bold"
                          >
                            {t("common.next")} <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex items-start gap-3 text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/40">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-primary/60 font-bold" />
              <p className="font-medium leading-relaxed">
                {t("budget.infoText")}
              </p>
            </div>
          </>
        )}

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

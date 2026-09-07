import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { AdminGuide } from "@/components/admin-guide";
import { ADMIN_GROUPS } from "@/lib/admin-menu";

/** 오늘 처리할 일 — 기존 테이블 집계만 쓴다. 실패는 0 이 아니라 null 로 구분한다. */
async function todoCounts() {
  try {
    const [payment, unconfirmed, suggestions, reportedPosts, reportedSuggestions] = await Promise.all([
      prisma.campaignOrder.count({ where: { status: "pending" } }),
      prisma.campaignOrder.count({
        where: { status: { not: "cancelled" }, confirmation: null, campaign: { confirmEnabled: true } },
      }),
      prisma.suggestion.count({ where: { response: null, hidden: false } }),
      prisma.post.count({ where: { reportCount: { gt: 0 }, hidden: false } }),
      prisma.suggestion.count({ where: { reportCount: { gt: 0 }, hidden: false } }),
    ]);
    return { payment, unconfirmed, suggestions, reports: reportedPosts + reportedSuggestions };
  } catch {
    return null; // DB 조회 실패를 "0건"으로 위장하지 않는다
  }
}

export default async function AdminPage() {
  const [session, todo] = await Promise.all([auth(), todoCounts()]);
  const TODO = [
    { label: "입금 대기", n: todo?.payment, href: "/admin/campaigns" },
    { label: "수령 확인 미응답", n: todo?.unconfirmed, href: "/admin/campaigns" },
    { label: "미답변 건의", n: todo?.suggestions, href: "/admin/community" },
    { label: "미처리 신고", n: todo?.reports, href: "/admin/community" },
  ];

  return (
    <div className="py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">대시보드</h1>
        <p className="text-muted-foreground mt-1">
          안녕하세요, <span className="font-semibold text-foreground">{session?.user?.name ?? "관리자"}</span>님. 오늘도 투명한 학생회 운영 화이팅!
        </p>
      </div>

      <section className="mb-8" aria-labelledby="todo-heading">
        <h2 id="todo-heading" className="text-sm font-bold text-muted-foreground mb-3">오늘 처리할 일</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TODO.map((c) => (
            <Link key={c.label} href={c.href} className="group">
              <Card className="h-full rounded-2xl border-border/60 transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-black tabular-nums ${c.n ? "text-primary" : ""}`}>{c.n ?? "-"}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!todo && <p className="mt-2 text-xs text-destructive">집계를 불러오지 못했습니다. 새로고침해 주세요.</p>}
      </section>

      <AdminGuide id="dashboard" title="관리자 시스템 안내">
        <p>왼쪽 메뉴(모바일은 상단 <strong>메뉴</strong> 버튼) 또는 아래 카드에서 작업할 영역을 고르세요. 각 페이지 위쪽에 그 페이지의 사용법이 있고, 한 번 접어두면 다음 방문 때도 접힌 상태로 열립니다.</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><strong>신청·사업 운영</strong> — 단체복·행사 신청과 수령 확인처럼 기간이 정해진 일.</li>
          <li><strong>소식·소통</strong> — 공지, 행사 사진, 건의 답변, 홈 팝업.</li>
          <li><strong>학과·학습 정보</strong> · <strong>학생회·사이트 설정</strong> — 가끔 손보는 기준 데이터.</li>
        </ul>
        <p className="text-xs">💡 공용 컴퓨터에서 작업했다면 우상단 <strong>로그아웃</strong> 잊지 마세요.</p>
      </AdminGuide>

      {ADMIN_GROUPS.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="text-sm font-bold text-muted-foreground mb-3">{g.title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {g.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group">
                  <Card className="h-full rounded-2xl border-border/60 transition-colors hover:border-primary/40 hover:bg-muted/40">
                    <CardContent className="p-5 space-y-2">
                      <Icon className={`h-5 w-5 ${g.tint}`} />
                      <p className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <div className="bg-muted/30 border border-border/40 rounded-2xl p-6">
        <p className="font-bold text-sm mb-4 flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          빠른 링크
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/", label: "홈페이지" },
            { href: "/notices", label: "공지사항" },
            { href: "/apply", label: "학생회 이벤트" },
            { href: "/check-fee", label: "과비 확인" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-primary hover:underline flex items-center gap-1 group"
            >
              {l.label}
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 mb-8 flex items-start gap-3 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p>
          관리자 세션은 자동으로 만료됩니다. 공용 컴퓨터 사용 후에는 반드시 <strong className="text-foreground">로그아웃</strong>하세요.
          비밀번호는 <code className="bg-muted px-1 rounded">.env.local</code>의 <code className="bg-muted px-1 rounded">ADMIN_PASSWORD</code>에서 변경할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { auth, signOut } from "@/lib/auth";
import { Settings, Bell, BookOpen, Users, Home, ExternalLink, ShieldCheck, LogOut, GraduationCap, Camera, Cookie, Megaphone, Building2, UserSquare, MessageSquare, Wrench } from "lucide-react";
import { AdminGuide } from "@/components/admin-guide";

export default async function AdminPage() {
  const session = await auth();

  const links = [
    {
      href: "/admin/notices",
      label: "공지사항 관리",
      icon: Bell,
      desc: "공지 작성·수정·삭제",
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      href: "/admin/resources",
      label: "학습자료 관리",
      icon: BookOpen,
      desc: "자료 업로드·삭제",
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    },
    {
      href: "/admin/members",
      label: "멤버 관리",
      icon: Users,
      desc: "학생회 임원진 등록·삭제",
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      href: "/admin/courses",
      label: "수업 정보 관리",
      icon: GraduationCap,
      desc: "전공 과목·전공서·강의 영상 등록",
      color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    },
    {
      href: "/admin/events",
      label: "행사 관리",
      icon: Camera,
      desc: "행사 갤러리·사진 업로드",
      color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    },
    {
      href: "/admin/snack-wishes",
      label: "간식 위시리스트",
      icon: Cookie,
      desc: "위시리스트 조회·삭제",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    {
      href: "/admin/popup",
      label: "홈화면 팝업",
      icon: Megaphone,
      desc: "방문자 팝업 ON/OFF + 링크 관리",
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
    {
      href: "/admin/buildings",
      label: "건물·평면도 관리",
      icon: Building2,
      desc: "건물·층·평면도 업로드",
      color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    },
    {
      href: "/admin/professors",
      label: "교수님 관리",
      icon: UserSquare,
      desc: "교수님 정보·오피스 등록",
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
    {
      href: "/admin/community",
      label: "커뮤니티 모더레이션",
      icon: MessageSquare,
      desc: "건의 답변·게시글 신고 처리",
      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    },
    {
      href: "/admin/site",
      label: "사이트 설정",
      icon: Wrench,
      desc: "운영시간·연락처·외부링크·동아리 관리",
      color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-black text-sm tracking-tight">관리자 시스템</p>
              <p className="text-xs text-muted-foreground">KAIST ME Council</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              {session?.user?.name ?? "관리자"}
            </Badge>
            <Link href="/" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              홈
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="outline" size="sm" type="submit" className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight">대시보드</h1>
          <p className="text-muted-foreground mt-1">
            안녕하세요, <span className="font-semibold text-foreground">{session?.user?.name ?? "관리자"}</span>님. 오늘도 투명한 학생회 운영 화이팅!
          </p>
        </div>

        <AdminGuide id="dashboard" title="관리자 시스템 안내">
          <p>아래 카드 중 작업할 영역을 선택하세요. 각 페이지 상단에 그 페이지의 자세한 사용법이 안내되어 있고, 한 번 읽고 접어두면 다음 방문 시 접힌 상태로 표시됩니다.</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li><strong>공지사항·공지/행사/학사</strong> 카테고리로 분류해서 발행 (상단 고정 가능).</li>
            <li><strong>행사 관리</strong> — 사이트에서 행사를 만들면 Google Drive 에 폴더가 자동으로 만들어지고 사진은 드래그앤드롭으로 Drive 에 직접 올라갑니다.</li>
            <li><strong>예산·간식 위시·팝업</strong> 같은 일상 관리 + <strong>건물·교수·수업·학습자료·멤버</strong> 같은 기준 데이터 관리.</li>
          </ul>
          <p className="text-xs">💡 공용 컴퓨터에서 작업했다면 우상단 <strong>로그아웃</strong> 잊지 마세요. 세션은 자동 만료되지만 안전을 위해 권장합니다.</p>
        </AdminGuide>

        {/* Management Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="h-full hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 cursor-pointer group hover:-translate-y-1 rounded-2xl border-border/60">
                  <CardHeader className="pb-2 pt-5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 border ${link.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors leading-tight">
                      {link.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="bg-muted/30 border border-border/40 rounded-2xl p-6">
          <p className="font-bold text-sm mb-4 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" />
            빠른 링크
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { href: "/", label: "홈페이지" },
              { href: "/notices", label: "공지사항" },
              { href: "/budget", label: "예산 내역" },
              { href: "/check-fee", label: "과비 확인" },
              { href: "/members", label: "학생회 소개" },
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

        {/* Security Note */}
        <div className="mt-6 flex items-start gap-3 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p>
            관리자 세션은 자동으로 만료됩니다. 공용 컴퓨터 사용 후에는 반드시 <strong className="text-foreground">로그아웃</strong>하세요.
            비밀번호는 <code className="bg-muted px-1 rounded">.env.local</code>의 <code className="bg-muted px-1 rounded">ADMIN_PASSWORD</code>에서 변경할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

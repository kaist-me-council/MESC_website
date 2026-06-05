import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SiteSettingsEditor from "@/components/admin/SiteSettingsEditor";
import { parseHours } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminSitePage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const links = await prisma.siteLink.findMany({ orderBy: { order: "asc" } });
  const clubs = await prisma.club.findMany({ orderBy: { order: "asc" } });

  const settings = {
    locationKo: s?.locationKo ?? "N7동 학생회실",
    locationEn: s?.locationEn ?? "Student Council Room, N7",
    email: s?.email ?? "kaist.mesc@gmail.com",
    phone: s?.phone ?? "",
    hours: parseHours(s?.hoursJson),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
            대시보드
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-black text-lg">사이트 설정</h1>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <SiteSettingsEditor initialSettings={settings} initialLinks={links} initialClubs={clubs} />
      </div>
    </div>
  );
}

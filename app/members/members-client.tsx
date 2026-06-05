"use client";

import Image from "next/image";
import { useLanguage } from "@/lib/language-context";
import { getClubColor } from "@/lib/site-settings";
import { ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Member {
  id: number;
  name: string;
  role: string;
  bureau: string;
  council: boolean;
  imageUrl: string | null;
  order: number;
}

interface Club {
  name: string;
  nameEn: string;
  tagKo: string;
  tagEn: string;
  descKo: string;
  descEn: string;
  activitiesKo: string[];
  activitiesEn: string[];
  url: string;
  urlLabel: "site" | "insta";
  emoji: string;
  colorPreset: string;
}

interface LinkRow {
  id: number;
  label: string;
  labelEn: string | null;
  url: string;
  description: string | null;
  descriptionEn: string | null;
  icon: string | null;
}

function MemberCard({ member }: { member: Member }) {
  return (
    <div className="flex flex-col items-center text-center group">
      <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted mb-3 ring-2 ring-border group-hover:ring-primary transition-all">
        {member.imageUrl ? (
          <Image src={member.imageUrl} alt={member.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground">
            👤
          </div>
        )}
      </div>
      <p className="font-semibold text-sm">{member.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{member.role}</p>
    </div>
  );
}

export function MembersClient({
  members,
  clubs,
  importantLinks,
  communityLinks,
}: {
  members: Member[];
  clubs: Club[];
  importantLinks: LinkRow[];
  communityLinks: LinkRow[];
}) {
  const { t, lang } = useLanguage();

  // 그룹화 로직
  const grouped: Record<string, Member[]> = {};
  for (const m of members) {
    const hasBureau = m.bureau && m.bureau.trim();
    if (!hasBureau || m.council) {
      if (!grouped["회장단"]) grouped["회장단"] = [];
      grouped["회장단"].push(m);
    }
    if (hasBureau) {
      const key = m.bureau.trim();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
  }
  const groupOrder = Object.keys(grouped).sort((a, b) => {
    if (a === "회장단") return -1;
    if (b === "회장단") return 1;
    return a.localeCompare(b, "ko");
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">{t("members.title")}</h1>
      <p className="text-muted-foreground mb-8">{t("members.subtitle")}</p>

      <Tabs defaultValue="council" className="mb-14">
        <TabsList className="mb-6">
          <TabsTrigger value="council">{t("members.tabCouncil")}</TabsTrigger>
          <TabsTrigger value="clubs">{t("members.tabClubs")}</TabsTrigger>
        </TabsList>

        {/* ── 학생회 구성원 탭 ── */}
        <TabsContent value="council">
          {members.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              {t("members.noMembers")}
            </div>
          ) : (
            <div className="space-y-10">
              {groupOrder.map((bureauName) => (
                <div key={bureauName}>
                  <h2 className="text-lg font-bold mb-4 pb-2 border-b border-border/60 flex items-center gap-2">
                    <span className="w-1.5 h-5 rounded-full bg-primary inline-block" />
                    {bureauName}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {grouped[bureauName].map((member) => (
                      <MemberCard key={member.id} member={member} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── 과동아리 탭 ── */}
        <TabsContent value="clubs">
          <p className="text-muted-foreground mb-6">{t("members.clubsSubtitle")}</p>
          <div className="grid md:grid-cols-2 gap-6">
            {clubs.map((club) => (
              <div
                key={club.name}
                className={`rounded-2xl border bg-gradient-to-br ${getClubColor(club.colorPreset)} p-6 flex flex-col gap-4`}
              >
                {/* 헤더 */}
                <div className="flex items-start gap-4">
                  <span className="text-5xl">{club.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-black">{club.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-background/60 border font-medium">
                        {lang === "en" ? club.tagEn : club.tagKo}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lang === "en" ? club.nameEn : club.name}
                    </p>
                  </div>
                </div>

                {/* 설명 */}
                <p className="text-sm leading-relaxed">
                  {lang === "en" ? club.descEn : club.descKo}
                </p>

                {/* 주요 활동 */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {lang === "en" ? "Key Activities" : "주요 활동"}
                  </p>
                  <ul className="space-y-1">
                    {(lang === "en" ? club.activitiesEn : club.activitiesKo).map((act) => (
                      <li key={act} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">▸</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 링크 버튼 */}
                <a
                  href={club.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-background/70 border hover:bg-background transition-colors text-sm font-medium w-fit"
                >
                  <ExternalLink className="h-4 w-4" />
                  {lang === "en"
                    ? (club.urlLabel === "site" ? t("members.visitSite") : t("members.visitInsta"))
                    : (club.urlLabel === "site" ? t("members.visitSite") : t("members.visitInsta"))}
                </a>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 주요 링크 */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4">{t("members.importantLinks")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {importantLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent hover:shadow-sm transition-all group"
            >
              <span className="text-2xl">{link.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {lang === "en" && link.labelEn ? link.labelEn : link.label}
                </p>
                {(lang === "en" ? link.descriptionEn : link.description) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {lang === "en" ? link.descriptionEn : link.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 커뮤니티 / SNS */}
      <section>
        <h2 className="text-xl font-bold mb-4">{t("members.community")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {communityLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target={link.url !== "#" ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent hover:shadow-sm transition-all group"
            >
              <span className="text-2xl">{link.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors flex items-center gap-1">
                  {lang === "en" && link.labelEn ? link.labelEn : link.label}
                  {link.url !== "#" && (
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                  )}
                </p>
                {(lang === "en" ? link.descriptionEn : link.description) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {lang === "en" ? link.descriptionEn : link.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

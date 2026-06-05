import { prisma } from "@/lib/prisma";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

async function getMembers() {
  return prisma.member.findMany({ orderBy: [{ order: "asc" }] });
}

export default async function MembersPage() {
  const members = await getMembers();
  const clubRows = await prisma.club.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
  const importantLinks = await prisma.siteLink.findMany({
    where: { enabled: true, category: "important" },
    orderBy: { order: "asc" },
  });
  const communityLinks = await prisma.siteLink.findMany({
    where: { enabled: true, category: "community" },
    orderBy: { order: "asc" },
  });

  const clubs = clubRows.map((c) => ({
    name: c.name,
    nameEn: c.nameEn ?? c.name,
    tagKo: c.tagKo ?? "",
    tagEn: c.tagEn ?? "",
    descKo: c.descKo,
    descEn: c.descEn ?? "",
    activitiesKo: (c.activitiesKo ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    activitiesEn: (c.activitiesEn ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    url: c.url ?? "",
    urlLabel: (c.urlLabel === "insta" ? "insta" : "site") as "site" | "insta",
    emoji: c.emoji ?? "",
    colorPreset: c.colorPreset ?? "blue",
  }));

  return (
    <MembersClient
      members={members}
      clubs={clubs}
      importantLinks={importantLinks}
      communityLinks={communityLinks}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/safe-query";
import { MembersClient } from "./members-client";

export const revalidate = 300; // 5분 ISR

async function getMembers() {
  return safeQuery("members", () => prisma.member.findMany({ orderBy: [{ order: "asc" }] }), []);
}

export default async function MembersPage() {
  const [members, clubRows, importantLinks, communityLinks] = await Promise.all([
    getMembers(),
    safeQuery("members/clubs", () => prisma.club.findMany({ where: { enabled: true }, orderBy: { order: "asc" } }), []),
    safeQuery("members/links", () => prisma.siteLink.findMany({ where: { enabled: true, category: "important" }, orderBy: { order: "asc" } }), []),
    safeQuery("members/links", () => prisma.siteLink.findMany({ where: { enabled: true, category: "community" }, orderBy: { order: "asc" } }), []),
  ]);

  const mascots = await safeQuery("members/mascots", () => prisma.mascot.findMany({
    where: { enabled: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, name: true, nameEn: true, tagKo: true, tagEn: true, descKo: true, descEn: true, imageUrl: true },
  }), []);

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
    instaUrl: c.instaUrl ?? "",
    emoji: c.emoji ?? "",
    colorPreset: c.colorPreset ?? "blue",
  }));

  return (
    <MembersClient
      members={members}
      clubs={clubs}
      importantLinks={importantLinks}
      communityLinks={communityLinks}
      mascots={mascots}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/safe-query";
import { HomeClient } from "@/components/home-client";

export const revalidate = 60; // 최신 공지 5건 — 1분 ISR (공개 트래픽 대비)

async function getRecentNotices() {
  return safeQuery("home/notices", () => prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 5,
  }), []);
}

export default async function HomePage() {
  const notices = await getRecentNotices();
  return <HomeClient notices={notices} />;
}

import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/home-client";

export const dynamic = "force-dynamic";

async function getRecentNotices() {
  return prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
}

export default async function HomePage() {
  const notices = await getRecentNotices();
  return <HomeClient notices={notices} />;
}

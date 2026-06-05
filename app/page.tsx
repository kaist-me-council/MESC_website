import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/home-client";
import { parseHours } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getRecentNotices() {
  return prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
}

export default async function HomePage() {
  const notices = await getRecentNotices();
  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const hours = parseHours(s?.hoursJson);

  return <HomeClient notices={notices} hours={hours} />;
}

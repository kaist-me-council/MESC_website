import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mesc-website.vercel.app";

// 공개 정적 경로 (/admin, /api 제외)
const STATIC_PATHS = [
  "",
  "/notices",
  "/resources",
  "/calendar",
  "/budget",
  "/check-fee",
  "/community",
  "/courses",
  "/members",
  "/department-info",
];

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  // 동적 경로 — DB 접근 실패해도 사이트맵 생성이 깨지지 않도록 방어
  const dynamicEntries: MetadataRoute.Sitemap = [];

  try {
    const notices = await prisma.notice.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    for (const n of notices) {
      dynamicEntries.push({
        url: `${BASE_URL}/notices/${n.id}`,
        lastModified: n.updatedAt ?? now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // 무시: 정적 경로만으로 사이트맵 반환
  }

  try {
    const courses = await prisma.course.findMany({
      select: { code: true },
      take: 500,
    });
    for (const c of courses) {
      dynamicEntries.push({
        url: `${BASE_URL}/courses/${encodeURIComponent(c.code)}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // 무시
  }

  return [...staticEntries, ...dynamicEntries];
}

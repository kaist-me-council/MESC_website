// 푸터용 사이트 설정 — 서버에서 한 번 읽어 레이아웃으로 내려준다.
// (예전엔 Footer 가 모든 페이지에서 /api/site-settings·/api/site-links 를 클라이언트로 호출했다)
// 타입·기본값은 클라이언트도 쓰므로 lib/site-settings.ts(순수 모듈)에 있다.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FOOTER_FALLBACK, type FooterData } from "@/lib/site-settings";

/** 5분 캐시. DB 실패는 기본값으로 흡수해 레이아웃이 절대 깨지지 않게 한다. */
export const getFooterData = unstable_cache(
  async (): Promise<FooterData> => {
    try {
      const [s, links] = await Promise.all([
        prisma.siteSettings.findUnique({ where: { id: 1 } }),
        prisma.siteLink.findMany({ where: { enabled: true, category: "community" }, orderBy: { order: "asc" } }),
      ]);
      return {
        contact: {
          locationKo: s?.locationKo ?? FOOTER_FALLBACK.contact.locationKo,
          locationEn: s?.locationEn ?? FOOTER_FALLBACK.contact.locationEn,
          email: s?.email ?? FOOTER_FALLBACK.contact.email,
        },
        sns: links.length
          ? links.map((l) => ({ label: l.label, labelEn: l.labelEn, url: l.url, icon: l.icon }))
          : FOOTER_FALLBACK.sns,
      };
    } catch {
      return FOOTER_FALLBACK;
    }
  },
  ["footer-data"],
  { revalidate: 300, tags: ["site-settings"] },
);

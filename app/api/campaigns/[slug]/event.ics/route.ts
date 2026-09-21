import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 공개: 캠페인 행사 일정을 캘린더 파일(.ics)로 내려준다.
 *
 * 학생이 "일정을 확인했습니다" 에 체크하는 것보다 캘린더에 실제로 들어가는 편이 낫다.
 * 데이터 URL 대신 서버에서 내려주는 이유: 아이폰 사파리가 data: 다운로드를 잘 다루지 못한다.
 * 행사 일시가 없는 캠페인은 404 (버튼도 안 보인다).
 */

const pad = (n: number) => String(n).padStart(2, "0");
/** UTC 기준 iCal 타임스탬프. 캘린더 앱이 각자 지역시간으로 보여 준다. */
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** RFC 5545: 쉼표·세미콜론·역슬래시는 이스케이프, 줄바꿈은 \n 으로 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const HOUR = 60 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await prisma.campaign.findUnique({
    where: { slug },
    select: { slug: true, title: true, description: true, eventAt: true, eventPlace: true, enabled: true },
  });
  if (!c || !c.enabled || !c.eventAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const start = c.eventAt;
  const end = new Date(start.getTime() + 2 * HOUR); // 종료 시각은 따로 받지 않는다 — 2시간으로 둔다
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KAIST ME Student Council//Campaign//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:campaign-${c.slug}@mesc`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(c.title)}`,
    ...(c.eventPlace ? [`LOCATION:${esc(c.eventPlace)}`] : []),
    ...(c.description ? [`DESCRIPTION:${esc(c.description.slice(0, 500))}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${c.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

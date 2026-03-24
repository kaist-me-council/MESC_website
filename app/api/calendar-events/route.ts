import { NextResponse } from "next/server";

const ICAL_URL = process.env.NEXT_PUBLIC_ICAL_URL ?? "";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string;
}

let cachedEvents: CalendarEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분

/** iCal 형식의 날짜 문자열을 JavaScript Date로 변환 */
function parseICalDate(dateStr: string): Date {
  // YYYYMMDD 또는 YYYYMMDDTHHMMSSZ 형식
  if (dateStr.length === 8) {
    // 날짜만 있는 경우
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  } else {
    // 시간까지 있는 경우
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11)) || 0;
    const minute = parseInt(dateStr.substring(11, 13)) || 0;
    const second = parseInt(dateStr.substring(13, 15)) || 0;
    return new Date(year, month, day, hour, minute, second);
  }
}

/** iCal 형식 파싱 */
function parseICalendar(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = text.split(/\r?\n/);
    interface RawEvent {
    DTSTART?: string;
    DTEND?: string;
    SUMMARY?: string;
    DESCRIPTION?: string;
    LOCATION?: string;
    UID?: string;
  }
  let currentEvent: RawEvent | null = null;
  let inEvent = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {};
    } else if (trimmed === "END:VEVENT") {
      if (inEvent && currentEvent) {
        const event = currentEvent;
        if (event.DTSTART) {
          const startDate = event.DTSTART;
          const endDate = event.DTEND || startDate;
          const allDay = startDate.length === 8; // YYYYMMDD 형식이면 올데이

          events.push({
            id: event.UID || `event-${Date.now()}-${Math.random()}`,
            title: event.SUMMARY || "일정",
            description: event.DESCRIPTION || "",
            startDate: startDate,
            endDate: endDate,
            allDay: allDay,
            location: event.LOCATION || "",
          });
        }
      }
      inEvent = false;
      currentEvent = null;
    } else if (inEvent && currentEvent && trimmed) {
      // 키:값 파싱
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        let key = trimmed.substring(0, colonIdx);
        let value = trimmed.substring(colonIdx + 1);

        // 파라미터 제거 (예: DTSTART;VALUE=DATE:20240101)
        const semicolonIdx = key.indexOf(";");
        if (semicolonIdx > 0) {
          key = key.substring(0, semicolonIdx);
        }

        // 이스케이프 문자 처리
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\,/g, ",")
          .replace(/\\\\/g, "\\");

        if (key === "DTSTART") {
          currentEvent.DTSTART = value;
        } else if (key === "DTEND") {
          currentEvent.DTEND = value;
        } else if (key === "SUMMARY") {
          currentEvent.SUMMARY = value;
        } else if (key === "DESCRIPTION") {
          currentEvent.DESCRIPTION = value;
        } else if (key === "LOCATION") {
          currentEvent.LOCATION = value;
        } else if (key === "UID") {
          currentEvent.UID = value;
        }
      }
    }
  }

  return events.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const now = Date.now();
  if (cachedEvents && now - cacheTime < CACHE_DURATION) {
    return cachedEvents;
  }

  if (!ICAL_URL) {
    return [];
  }

  try {
    const res = await fetch(ICAL_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("캘린더를 불러올 수 없습니다.");

    const text = await res.text();
    const events = parseICalendar(text);

    cachedEvents = events;
    cacheTime = now;
    return events;
  } catch (error) {
    console.error("[calendar-events]", error);
    return [];
  }
}

export async function GET() {
  try {
    const events = await fetchCalendarEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error("[calendar-events]", error);
    return NextResponse.json(
      { error: "캘린더 데이터를 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { parseICalendar, type CalendarEvent } from "@/lib/ical";

const ICAL_URL = process.env.NEXT_PUBLIC_ICAL_URL ?? "";

let cachedEvents: CalendarEvent[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분

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

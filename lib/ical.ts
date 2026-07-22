// iCal(RFC 5545) 파싱 — next/server 비의존 순수 로직(테스트: scripts/ical.test.mjs)

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string;
}

/**
 * iCal 날짜 값을 절대 시각(Date)으로 파싱.
 * - `Z` 접미사: UTC 로 파싱.
 * - TZID/무접미사: KST 벽시계로 간주(한국 캘린더 기본) → UTC 로 −9h 환산.
 * - 8자리(VALUE=DATE): 날짜만 → UTC 자정.
 */
export function parseICalDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  if (dateStr.length === 8) {
    return new Date(Date.UTC(year, month, day));
  }
  const hour = parseInt(dateStr.substring(9, 11)) || 0;
  const minute = parseInt(dateStr.substring(11, 13)) || 0;
  const second = parseInt(dateStr.substring(13, 15)) || 0;
  const ms = Date.UTC(year, month, day, hour, minute, second);
  return new Date(dateStr.endsWith("Z") ? ms : ms - 9 * 3600 * 1000);
}

/**
 * iCal 날짜 값을 KST 벽시계 표시 문자열(YYYYMMDD 또는 YYYYMMDDTHHMMSS)로 정규화.
 * 소비처(app/calendar)가 substring 으로 그대로 표시하므로 여기서 KST 기준으로 맞춘다.
 * 날짜만(8자리)은 하루 어긋남 없이 그대로 통과.
 */
export function toKSTDateString(dateStr: string): string {
  if (dateStr.length === 8) return dateStr;
  const kst = new Date(parseICalDate(dateStr).getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}` +
    `T${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}${p(kst.getUTCSeconds())}`
  );
}

interface RawEvent {
  DTSTART?: string;
  DTEND?: string;
  SUMMARY?: string;
  DESCRIPTION?: string;
  LOCATION?: string;
  UID?: string;
}

/** iCal 형식 파싱 */
export function parseICalendar(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  // RFC 5545 line-folding 언폴딩: 개행 뒤 공백/탭으로 이어진 줄 병합
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
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
          const rawStart = event.DTSTART;
          const rawEnd = event.DTEND || rawStart;
          const allDay = rawStart.length === 8; // YYYYMMDD 형식이면 올데이

          events.push({
            id: event.UID || `event-${Date.now()}-${Math.random()}`,
            title: event.SUMMARY || "일정",
            description: event.DESCRIPTION || "",
            startDate: toKSTDateString(rawStart),
            endDate: toKSTDateString(rawEnd),
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

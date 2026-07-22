// node scripts/ical.test.mjs — 의존성 없는 iCal 파서 검증
import assert from "node:assert/strict";
import { parseICalendar, toKSTDateString } from "../lib/ical.ts";

// 1) RFC 5545 line-folding: 개행+공백으로 접힌 SUMMARY 언폴딩
const folded = [
  "BEGIN:VEVENT",
  "UID:evt-1",
  "DTSTART:20240101T000000Z",
  "SUMMARY:신년 행사 아주 긴 제",
  " 목입니다",
  "END:VEVENT",
].join("\r\n");
const [ev] = parseICalendar(folded);
assert.equal(ev.title, "신년 행사 아주 긴 제목입니다");

// 2) Z(UTC) → KST(+9h) 표시
assert.equal(ev.startDate, "20240101T090000");

// 3) TZID/무접미사(이미 KST 벽시계) → 그대로
assert.equal(toKSTDateString("20240101T090000"), "20240101T090000");

// 4) 날짜만(VALUE=DATE, 8자리) → 그대로 + allDay, 하루 어긋남 없음
const [allday] = parseICalendar(
  ["BEGIN:VEVENT", "DTSTART;VALUE=DATE:20240101", "SUMMARY:개강", "END:VEVENT"].join("\r\n"),
);
assert.equal(allday.startDate, "20240101");
assert.equal(allday.allDay, true);

console.log("✅ ical.test.mjs 통과");

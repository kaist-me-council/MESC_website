// node scripts/site-settings.test.mjs — 의존성 없는 순수 함수 검증
import assert from "node:assert/strict";
import {
  parseHours,
  formatWeekdayHours,
  formatLunch,
  isWeekendClosed,
  getClubColor,
  DEFAULT_OPERATING_HOURS,
  DEFAULT_CLUB_COLOR,
  CLUB_COLOR_PRESETS,
} from "../lib/site-settings.ts";

// parseHours: 잘못된 입력 → 기본값
assert.deepEqual(parseHours(null), DEFAULT_OPERATING_HOURS);
assert.deepEqual(parseHours("not json"), DEFAULT_OPERATING_HOURS);
assert.deepEqual(parseHours('{"days":[]}'), DEFAULT_OPERATING_HOURS);

// 기본값: 평일 09-18, 점심 12-13, 주말 휴무
const def = DEFAULT_OPERATING_HOURS;
assert.equal(formatWeekdayHours(def), "09:00 - 18:00");
assert.equal(formatLunch(def), "12:00 - 13:00");
assert.equal(isWeekendClosed(def), true);

// 평일 모두 휴무 → null
const allClosed = { days: def.days.map((d) => ({ ...d, closed: true })), lunch: null };
assert.equal(formatWeekdayHours(allClosed), null);
assert.equal(formatLunch(allClosed), null);

// 색상 프리셋
assert.equal(getClubColor("orange"), CLUB_COLOR_PRESETS.orange);
assert.equal(getClubColor("nonexistent"), DEFAULT_CLUB_COLOR);
assert.equal(getClubColor(null), DEFAULT_CLUB_COLOR);

console.log("✅ site-settings.test.mjs 통과");

-- 행사 일시·장소 — 캘린더 추가(.ics) 와 안내 표시용
ALTER TABLE "Campaign" ADD COLUMN "eventAt" DATETIME;
ALTER TABLE "Campaign" ADD COLUMN "eventPlace" TEXT;

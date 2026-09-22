-- 유료(입금 필요) 행사 — 신청 폼에서 계좌 안내 + "입금했습니다" 필수 체크
ALTER TABLE "Campaign" ADD COLUMN "requiresPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampaignOrder" ADD COLUMN "depositCheckedAt" DATETIME;

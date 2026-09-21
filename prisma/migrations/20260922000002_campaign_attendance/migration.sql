-- 참석 확인(체크인) — 보증금 환불 대상 산출용
ALTER TABLE "CampaignOrder" ADD COLUMN "attendedAt" DATETIME;

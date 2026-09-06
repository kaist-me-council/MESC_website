-- 캠페인 v2: 굿즈 상품형·수령 확인 흡수·import 출처. PriorPurchase 는 캠페인 주문으로 대체.
ALTER TABLE "Campaign" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'signup';
ALTER TABLE "Campaign" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "confirmEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN "confirmDeadline" DATETIME;
ALTER TABLE "Campaign" ADD COLUMN "confirmNote" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "confirmNoteEn" TEXT;
ALTER TABLE "CampaignOrder" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "CampaignOrder" ADD COLUMN "confirmation" TEXT;
ALTER TABLE "CampaignOrder" ADD COLUMN "resolution" TEXT;
ALTER TABLE "CampaignOrder" ADD COLUMN "confirmNote" TEXT;
ALTER TABLE "CampaignOrder" ADD COLUMN "confirmedAt" DATETIME;
DROP INDEX IF EXISTS "PriorPurchase_studentIdHash_idx";
DROP INDEX IF EXISTS "PriorPurchase_email_idx";
DROP TABLE IF EXISTS "PriorPurchase";

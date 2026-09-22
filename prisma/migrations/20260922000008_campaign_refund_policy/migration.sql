-- 캠페인별 취소 접수 마감 및 단계별 환불 기준
ALTER TABLE "Campaign" ADD COLUMN "cancelDeadline" DATETIME;
ALTER TABLE "Campaign" ADD COLUMN "refundPolicy" TEXT;

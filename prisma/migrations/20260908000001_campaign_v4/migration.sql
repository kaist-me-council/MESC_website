-- 본인 취소용 관리 코드(해시만) + 재전송 방지 키
ALTER TABLE "CampaignOrder" ADD COLUMN "manageCodeHash" TEXT;
ALTER TABLE "CampaignOrder" ADD COLUMN "idempotencyKey" TEXT;
-- SQLite 는 NULL 을 서로 다른 값으로 보므로 키 없는 기존/적재 주문은 제약을 받지 않는다.
CREATE UNIQUE INDEX "CampaignOrder_campaignId_idempotencyKey_key" ON "CampaignOrder"("campaignId", "idempotencyKey");

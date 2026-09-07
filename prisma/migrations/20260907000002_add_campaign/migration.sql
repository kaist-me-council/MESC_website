-- 학생회 이벤트(신청·구매 캠페인)
CREATE TABLE "Campaign" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" DATETIME,
    "closesAt" DATETIME,
    "bankInfo" TEXT,
    "afterNote" TEXT,
    "afterNoteEn" TEXT,
    "allowQty" BOOLEAN NOT NULL DEFAULT true,
    "maxPerPerson" INTEGER,
    "requireStudentId" BOOLEAN NOT NULL DEFAULT true,
    "priceAdjust" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");
CREATE TABLE "CampaignOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "group" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CampaignOption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CampaignOption_campaignId_order_idx" ON "CampaignOption"("campaignId", "order");
CREATE TABLE "CampaignOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "orderNo" TEXT NOT NULL,
    "affiliation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentIdHash" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "items" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "adminMemo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignOrder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CampaignOrder_orderNo_key" ON "CampaignOrder"("orderNo");
CREATE INDEX "CampaignOrder_campaignId_status_idx" ON "CampaignOrder"("campaignId", "status");
CREATE INDEX "CampaignOrder_campaignId_studentIdHash_idx" ON "CampaignOrder"("campaignId", "studentIdHash");
CREATE INDEX "CampaignOrder_campaignId_email_idx" ON "CampaignOrder"("campaignId", "email");

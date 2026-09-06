-- 반팔티 1차 구매 확인 (학번 원문 미저장)
CREATE TABLE "PriorPurchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "affiliation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentIdHash" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "items" TEXT NOT NULL,
    "pickedUp" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "response" TEXT,
    "resolution" TEXT,
    "responseNote" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PriorPurchase_studentIdHash_idx" ON "PriorPurchase"("studentIdHash");
CREATE INDEX "PriorPurchase_email_idx" ON "PriorPurchase"("email");

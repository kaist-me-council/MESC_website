-- 공지 첨부파일 · 웹 푸시 구독
CREATE TABLE "NoticeAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "noticeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoticeAttachment_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NoticeAttachment_noticeId_idx" ON "NoticeAttachment"("noticeId");
CREATE TABLE "PushSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" DATETIME,
    "failCount" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

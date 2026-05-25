-- AlterTable: Event 에 Drive 동기화 필드 추가
ALTER TABLE "Event" ADD COLUMN "driveFolderId" TEXT;
ALTER TABLE "Event" ADD COLUMN "lastSyncedAt" DATETIME;

-- AlterTable: EventPhoto 에 출처 / Drive 파일 ID 추가
ALTER TABLE "EventPhoto" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'blob';
ALTER TABLE "EventPhoto" ADD COLUMN "driveFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Event_driveFolderId_key" ON "Event"("driveFolderId");
CREATE UNIQUE INDEX "EventPhoto_driveFileId_key" ON "EventPhoto"("driveFileId");

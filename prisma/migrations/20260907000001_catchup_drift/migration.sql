-- 마이그레이션 없이 프로덕션에 수동 반영돼 있던 스키마 보정 (libsql-migrate 는 이미 존재하면 건너뜀)
ALTER TABLE "Club" ADD COLUMN "instaUrl" TEXT;
ALTER TABLE "Notice" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Notice" ADD COLUMN "contentEn" TEXT;
CREATE TABLE "AdminAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdminAccount_username_key" ON "AdminAccount"("username");

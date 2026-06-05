-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "locationKo" TEXT NOT NULL DEFAULT 'N7동 학생회실',
    "locationEn" TEXT NOT NULL DEFAULT 'Student Council Room, N7',
    "email" TEXT NOT NULL DEFAULT 'kaist.mesc@gmail.com',
    "phone" TEXT,
    "hoursJson" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL DEFAULT 'important',
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "descriptionEn" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Club" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "tagKo" TEXT,
    "tagEn" TEXT,
    "descKo" TEXT NOT NULL,
    "descEn" TEXT,
    "activitiesKo" TEXT,
    "activitiesEn" TEXT,
    "url" TEXT,
    "urlLabel" TEXT,
    "emoji" TEXT,
    "colorPreset" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SiteLink_category_order_idx" ON "SiteLink"("category", "order");

-- CreateTable
CREATE TABLE "PopupSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL DEFAULT '기계공학과 학생회',
    "message" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PopupLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Building" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "BuildingFloor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buildingId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    CONSTRAINT "BuildingFloor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "title" TEXT NOT NULL DEFAULT '교수',
    "buildingId" INTEGER,
    "floorId" INTEGER,
    "roomNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "researchArea" TEXT,
    "websiteUrl" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Professor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Professor_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "BuildingFloor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_code_key" ON "Building"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingFloor_buildingId_level_key" ON "BuildingFloor"("buildingId", "level");

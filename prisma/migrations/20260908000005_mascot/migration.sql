-- 학과 마스코트
CREATE TABLE "Mascot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "tagKo" TEXT,
    "tagEn" TEXT,
    "descKo" TEXT NOT NULL,
    "descEn" TEXT,
    "imageUrl" TEXT,
    "images" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "Course" ADD COLUMN "descriptionEn" TEXT;

-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "author" TEXT,
    "publisher" TEXT,
    "coverImage" TEXT,
    "isbn" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "courseId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Book_courseId_idx" ON "Book"("courseId");
CREATE INDEX "Book_category_idx" ON "Book"("category");

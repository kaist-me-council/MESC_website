-- CreateTable
CREATE TABLE "CourseReview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "courseId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CourseReview_courseId_hidden_createdAt_idx" ON "CourseReview"("courseId", "hidden", "createdAt");

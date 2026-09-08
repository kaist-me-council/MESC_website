-- 공지 첨부를 구글 드라이브에도 저장할 수 있게 (Blob 행은 driveFileId 가 NULL)
ALTER TABLE "NoticeAttachment" ADD COLUMN "driveFileId" TEXT;

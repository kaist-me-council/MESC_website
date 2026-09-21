-- 캠페인 추가 문항(설문) — 문항 정의는 캠페인에, 답변은 신청 건에 JSON 으로 둔다.
ALTER TABLE "Campaign" ADD COLUMN "questions" TEXT;
ALTER TABLE "CampaignOrder" ADD COLUMN "answers" TEXT;

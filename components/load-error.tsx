"use client";

import { Button } from "@/components/ui/button";
import { errText, type ReqFail, type T } from "@/lib/fetch-state";

/** 공개 화면 공용 "불러오기 실패 + 다시 시도". 빈 목록과 절대 같은 화면을 쓰지 않는다. */
export function LoadError({ fail, t, onRetry }: { fail: ReqFail; t: T; onRetry: () => void }) {
  return (
    <div role="alert" className="text-center py-12 space-y-3">
      <p className="text-sm text-destructive">{errText(fail, t)}</p>
      <Button variant="outline" className="min-h-10" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

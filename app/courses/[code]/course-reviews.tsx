"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, MessageSquare, Send, Flag, Pencil, Trash2 } from "lucide-react";

interface Review {
  id: number;
  rating: number;
  content: string;
  nickname: string;
  createdAt: string;
}

/** 별점 선택 — 버튼 그룹 + 호버 프리뷰 (행사 피드백 EventFeedback 패턴 재사용) */
function StarInput({
  value,
  onChange,
  ariaLabel,
  starLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  starLabel: (n: number) => string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((s) => {
        const active = s <= (hover || value);
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === value}
            aria-label={starLabel(s)}
            onClick={() => onChange(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="p-1.5 rounded transition-transform active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                active ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/40"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** 별점 표시 (읽기 전용) */
function StarDisplay({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${size} ${s <= value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function CourseReviews({ courseId }: { courseId: number }) {
  const { lang, t } = useLanguage();
  const locale = lang === "ko" ? "ko-KR" : "en-US";
  const starLabel = (n: number) => t("courses.reviewsStarAria").replace("{n}", String(n));

  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 작성 폼
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitDone, setSubmitDone] = useState(false);

  // 인라인 수정
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editContent, setEditContent] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  async function load() {
    try {
      const r = await fetch(`/api/courses/${courseId}/reviews`);
      if (r.ok) {
        const data = await r.json();
        setReviews(data.reviews ?? []);
        setAverage(data.average ?? null);
        setCount(data.count ?? (data.reviews?.length ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function submit() {
    if (rating < 1) {
      setSubmitError(t("courses.reviewsRatingRequired"));
      return;
    }
    if (!nickname.trim() || !password.trim() || !content.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const r = await fetch(`/api/courses/${courseId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          password: password.trim(),
          rating,
          content: content.trim(),
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setNickname("");
        setPassword("");
        setRating(0);
        setContent("");
        setSubmitDone(true);
        setTimeout(() => setSubmitDone(false), 3000);
        await load();
      } else {
        setSubmitError(data.error ?? t("courses.reviewsError"));
      }
    } catch {
      setSubmitError(t("courses.reviewsError"));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(review: Review) {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditContent(review.content);
    setEditPassword("");
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPassword("");
    setEditError("");
  }

  async function saveEdit(id: number) {
    if (!editPassword.trim()) {
      setEditError(t("courses.reviewsPasswordRequired"));
      return;
    }
    if (editRating < 1 || !editContent.trim()) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const r = await fetch(`/api/course-reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: editPassword.trim(),
          rating: editRating,
          content: editContent.trim(),
        }),
      });
      const data = await r.json();
      if (r.ok) {
        cancelEdit();
        await load();
      } else {
        setEditError(data.error ?? t("courses.reviewsError"));
      }
    } catch {
      setEditError(t("courses.reviewsError"));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function remove(id: number) {
    const password = prompt(t("courses.reviewsDeletePrompt"));
    if (password === null) return;
    const r = await fetch(`/api/course-reviews/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.trim() || undefined }),
    });
    if (r.ok) {
      alert(t("courses.reviewsDeleteDone"));
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.error ?? t("courses.reviewsError"));
    }
  }

  async function report(id: number) {
    const reason = prompt(t("courses.reviewsReportPrompt"));
    if (reason === null) return;
    const r = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "courseReview", targetId: id, reason: reason.trim() || undefined }),
    });
    if (r.ok) {
      alert(t("courses.reviewsReportDone"));
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.error ?? t("courses.reviewsError"));
    }
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          {t("courses.reviewsTitle")} ({t("courses.reviewsCount").replace("{count}", String(count))})
        </h2>
        {average !== null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-semibold tabular-nums">{average.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* 작성 폼 */}
      <Card className="mb-6 border-border/60 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-medium">{t("courses.reviewsFormTitle")}</p>
          <StarInput
            value={rating}
            onChange={setRating}
            ariaLabel={t("courses.reviewsRatingAria")}
            starLabel={starLabel}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("courses.reviewsNicknamePlaceholder")}
              maxLength={20}
              className="h-10"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("courses.reviewsPasswordPlaceholder")}
              maxLength={50}
              className="h-10"
            />
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("courses.reviewsContentPlaceholder")}
            maxLength={1000}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">{content.length}/1000</span>
            <Button
              onClick={submit}
              disabled={submitting || !nickname.trim() || !password.trim() || !content.trim()}
              size="sm"
              className="min-h-10 gap-2"
            >
              <Send className="h-3 w-3" />
              {submitting ? t("courses.reviewsSubmitting") : t("courses.reviewsSubmit")}
            </Button>
          </div>
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{submitError}</AlertDescription>
            </Alert>
          )}
          {submitDone && <p className="text-xs text-green-600">{t("courses.reviewsSubmitDone")}</p>}
        </CardContent>
      </Card>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">{t("courses.reviewsEmpty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="border-border/60 rounded-xl">
              <CardContent className="p-4">
                {editingId === review.id ? (
                  <div className="space-y-3">
                    <StarInput
                      value={editRating}
                      onChange={setEditRating}
                      ariaLabel={t("courses.reviewsRatingAria")}
                      starLabel={starLabel}
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={1000}
                      rows={3}
                    />
                    <Input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder={t("courses.reviewsPasswordPlaceholder")}
                      maxLength={50}
                      className="h-10"
                    />
                    {editError && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-xs">{editError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editSubmitting} className="min-h-10">
                        {t("courses.reviewsCancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(review.id)}
                        disabled={editSubmitting || !editContent.trim()}
                        className="min-h-10"
                      >
                        {t("courses.reviewsSave")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StarDisplay value={review.rating} />
                        <span className="text-sm font-semibold truncate">{review.nickname}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          · {new Date(review.createdAt).toLocaleDateString(locale)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(review)}
                          className="p-2 -m-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                          title={t("courses.reviewsEdit")}
                          aria-label={t("courses.reviewsEdit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(review.id)}
                          className="p-2 -m-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                          title={t("courses.reviewsDelete")}
                          aria-label={t("courses.reviewsDelete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => report(review.id)}
                          className="p-2 -m-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                          title={t("courses.reviewsReport")}
                          aria-label={t("courses.reviewsReport")}
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{review.content}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, Camera, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";

interface EventDetail {
  id: number;
  title: string;
  date: string;
  description: string | null;
  photos: { id: number; imageUrl: string; caption: string | null }[];
  feedbacks: { id: number; content: string; rating: number; createdAt: string }[];
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((s) => (
        <button key={s} type="button" onClick={() => onChange?.(s)} className="focus:outline-none p-2 -m-2">
          <Star className={`h-5 w-5 transition-colors ${s <= value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang: language } = useLanguage();
  const locale = language === "ko" ? "ko-KR" : "en-US";
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitDone, setSubmitDone] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${id}`).then(r => r.json()).then(setEvent);
  }, [id]);

  async function submitFeedback() {
    if (!feedbackContent.trim()) return;
    setSubmitting(true); setSubmitError("");
    const res = await fetch(`/api/events/${id}/feedback`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: feedbackContent.trim(), rating: feedbackRating }),
    });
    const data = await res.json();
    if (res.ok) {
      setEvent(prev => prev ? { ...prev, feedbacks: [data, ...prev.feedbacks] } : prev);
      setFeedbackContent(""); setFeedbackRating(5); setSubmitDone(true);
      setTimeout(() => setSubmitDone(false), 3000);
    } else {
      setSubmitError(data.error ?? (language === "ko" ? "오류가 발생했습니다." : "An error occurred."));
    }
    setSubmitting(false);
  }

  if (!event) return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="skeleton h-8 w-48 rounded mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
    </div>
  );

  const avgRating = event.feedbacks.length > 0
    ? (event.feedbacks.reduce((s, f) => s + f.rating, 0) / event.feedbacks.length).toFixed(1)
    : null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {language === "ko" ? "커뮤니티로" : "Back to Community"}
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight mb-1">{event.title}</h1>
        <p className="text-sm text-muted-foreground mb-2">{new Date(event.date).toLocaleDateString(locale)}</p>
        {event.description && <p className="text-muted-foreground leading-relaxed">{event.description}</p>}
      </div>

      {/* 사진 그리드 */}
      {event.photos.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {language === "ko" ? `사진 (${event.photos.length}장)` : `Photos (${event.photos.length})`}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {event.photos.map((photo) => (
              <button key={photo.id} onClick={() => setLightbox(photo.imageUrl)}
                className="relative aspect-square overflow-hidden rounded-xl bg-muted hover:opacity-90 transition-opacity">
                <Image src={photo.imageUrl} alt={photo.caption ?? ""} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl max-h-[90vh] w-full h-full">
            <Image src={lightbox} alt="" fill className="object-contain" />
          </div>
        </div>
      )}

      {/* 피드백 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {language === "ko" ? `피드백 (${event.feedbacks.length}개)` : `Feedback (${event.feedbacks.length})`}
          </h2>
          {avgRating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-semibold">{avgRating}</span>
            </div>
          )}
        </div>

        {/* 피드백 작성 폼 */}
        <Card className="mb-6 border-border/60 rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium">{language === "ko" ? "행사 후기를 남겨주세요" : "Leave your feedback"}</p>
            <StarRating value={feedbackRating} onChange={setFeedbackRating} />
            <Textarea
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              placeholder={language === "ko" ? "행사에 대한 의견을 자유롭게 작성해주세요. (익명)" : "Share your thoughts (anonymous)"}
              maxLength={500}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{feedbackContent.length}/500</span>
              <Button onClick={submitFeedback} disabled={submitting || !feedbackContent.trim()} size="sm" className="gap-2">
                <Send className="h-3 w-3" />
                {submitting ? (language === "ko" ? "제출 중..." : "Submitting...") : language === "ko" ? "제출" : "Submit"}
              </Button>
            </div>
            {submitError && <p className="text-xs text-destructive">{submitError}</p>}
            {submitDone && <p className="text-xs text-green-600">{language === "ko" ? "피드백이 제출되었습니다!" : "Feedback submitted!"}</p>}
          </CardContent>
        </Card>

        {/* 피드백 목록 */}
        <div className="space-y-3">
          {event.feedbacks.map((fb) => (
            <Card key={fb.id} className="border-border/60 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <StarRating value={fb.rating} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(fb.createdAt).toLocaleDateString(locale)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{fb.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

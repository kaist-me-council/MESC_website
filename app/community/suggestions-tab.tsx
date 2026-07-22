"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Inbox, CheckCircle2, Flag } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface Suggestion {
  id: number;
  category: string;
  content: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

const CATEGORIES = ["행사", "시설", "학사", "기타"] as const;

export function SuggestionsTab() {
  const { lang: language } = useLanguage();
  const locale = language === "ko" ? "ko-KR" : "en-US";
  const [items, setItems] = useState<Suggestion[]>([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("기타");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function load() {
    const r = await fetch("/api/suggestions");
    if (r.ok) setItems(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!content.trim()) return;
    setSubmitting(true); setError(""); setSuccess(false);
    const r = await fetch("/api/suggestions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, content: content.trim(), contactInfo: contactInfo.trim() || undefined }),
    });
    const data = await r.json();
    if (r.ok) {
      setContent(""); setContactInfo(""); setSuccess(true);
      load();
    } else {
      setError(data.error ?? (language === "ko" ? "오류가 발생했습니다." : "An error occurred."));
    }
    setSubmitting(false);
  }

  async function report(id: number) {
    if (!confirm("이 건의를 신고하시겠습니까? 신고가 누적되면 자동으로 숨겨집니다.")) return;
    const r = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "suggestion", targetId: id }),
    });
    if (r.ok) alert("신고 접수되었습니다.");
    else { const d = await r.json(); alert(d.error ?? "신고 실패"); }
  }

  return (
    <div className="max-w-2xl">
      {/* 작성 폼 */}
      <Card className="mb-6 border-border/60 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            학생회에 건의하기
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            익명으로 학생회에 의견·요청·문제를 전달할 수 있습니다. 학생회가 답변하면 아래 목록에 함께 표시됩니다.
            <br />💡 답변이 필요하면 연락처(이메일·학번) 칸에 적어주세요 — 학생회만 볼 수 있고 공개되지 않습니다.
          </p>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={language === "ko" ? "건의 내용 (5~2000자)" : "Suggestion (5-2000 chars)"}
            rows={4}
            maxLength={2000}
          />
          <Input
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="(선택) 답변 받을 연락처 — 학생회만 봄"
            maxLength={100}
          />
          <Button onClick={submit} disabled={submitting || !content.trim()} className="w-full gap-2">
            <Send className="h-4 w-4" />{submitting ? "전송 중..." : "익명 건의 보내기"}
          </Button>
          {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}
          {success && <Alert><AlertDescription className="text-xs">전달되었습니다. 답변이 달리면 아래에서 확인할 수 있어요.</AlertDescription></Alert>}
        </CardContent>
      </Card>

      {/* 목록 */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">
        지난 건의 ({items.length}건)
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">등록된 건의가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id} className="border-border/60 rounded-xl">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{s.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <button onClick={() => report(s.id)} className="p-2 -m-2 text-muted-foreground hover:text-destructive" title={language === "ko" ? "신고" : "Report"}>
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{s.content}</p>
                {s.response && (
                  <div className="border-l-2 border-primary/50 bg-primary/5 rounded-r-lg p-3 text-sm">
                    <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      학생회 답변
                      {s.respondedAt && (
                        <span className="text-muted-foreground font-normal ml-1">
                          · {new Date(s.respondedAt).toLocaleDateString(locale)}
                        </span>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap">{s.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

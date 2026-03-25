"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, MessageSquare, Cookie, Star, ChevronRight, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Event {
  id: number;
  title: string;
  date: string;
  description: string | null;
  coverImage: string | null;
  _count: { feedbacks: number };
  photos: { id: number; imageUrl: string }[];
}

interface SnackWish {
  id: number;
  content: string;
  createdAt: string;
}

const TABS = ["갤러리", "간식 위시리스트"] as const;
type Tab = typeof TABS[number];

export default function CommunityPage() {
  const { lang: language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("갤러리");
  const [events, setEvents] = useState<Event[]>([]);
  const [wishes, setWishes] = useState<SnackWish[]>([]);
  const [wishInput, setWishInput] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishError, setWishError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events").then(r => r.json()).then(d => { setEvents(d); setLoading(false); });
    fetch("/api/snack-wishes").then(r => r.json()).then(setWishes);
  }, []);

  async function submitWish() {
    if (!wishInput.trim() || wishSubmitting) return;
    setWishSubmitting(true); setWishError("");
    const res = await fetch("/api/snack-wishes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: wishInput.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setWishes(prev => [data, ...prev]); setWishInput("");
    } else {
      setWishError(data.error ?? "오류가 발생했습니다.");
    }
    setWishSubmitting(false);
  }

  const TAB_LABELS: Record<Tab, string> = {
    "갤러리": language === "ko" ? "갤러리" : "Gallery",
    "간식 위시리스트": language === "ko" ? "간식 위시리스트" : "Snack Wishlist",
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10">

        <h1 className="text-4xl font-black tracking-tight mb-2">
          {language === "ko" ? "커뮤니티" : "Community"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ko"
            ? "학생회 행사 갤러리와 간식 위시리스트를 확인하세요."
            : "Browse event galleries and share your snack wishlist."}
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* 갤러리 탭 */}
      {activeTab === "갤러리" && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="skeleton h-56 rounded-2xl" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Camera className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>{language === "ko" ? "등록된 행사가 없습니다." : "No events yet."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Link key={event.id} href={`/community/${event.id}`}>
                <Card className="hover-lift-premium cursor-pointer overflow-hidden border-border/60 rounded-2xl h-full">
                  <div className="relative h-40 bg-muted">
                    {event.coverImage ? (
                      <Image src={event.coverImage} alt={event.title} fill className="object-cover" />
                    ) : event.photos[0] ? (
                      <Image src={event.photos[0].imageUrl} alt={event.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <p className="font-bold mb-1 truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(event.date).toLocaleDateString("ko-KR")}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs gap-1">
                          <Camera className="h-3 w-3" />{event.photos.length}
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1">
                          <MessageSquare className="h-3 w-3" />{event._count.feedbacks}
                        </Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      )}

      {/* 간식 위시리스트 탭 */}
      {activeTab === "간식 위시리스트" && (
        <div className="max-w-xl">
          <Card className="mb-6 border-border/60 rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Cookie className="h-4 w-4 text-primary" />
                {language === "ko" ? "먹고 싶은 간식을 적어주세요!" : "Tell us what snacks you want!"}
              </p>
              <div className="flex gap-2">
                <Input
                  value={wishInput}
                  onChange={(e) => setWishInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitWish()}
                  placeholder={language === "ko" ? "간식 이름 (최대 100자)" : "Snack name (max 100 chars)"}
                  maxLength={100}
                  className="flex-1"
                />
                <Button onClick={submitWish} disabled={wishSubmitting || !wishInput.trim()} size="sm" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {wishError && <p className="text-xs text-destructive mt-2">{wishError}</p>}
            </CardContent>
          </Card>

          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            {language === "ko" ? `위시리스트 (${wishes.length}개)` : `Wishlist (${wishes.length})`}
          </h3>
          <div className="space-y-2">
            {wishes.map((w, i) => (
              <Card key={w.id} className="border-border/60 rounded-xl">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  <Cookie className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm flex-1">{w.content}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(w.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

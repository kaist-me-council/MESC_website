"use client";

import { adminFetch } from "@/lib/admin-fetch";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";
import { AdminGuide } from "@/components/admin-guide";

interface SnackWish {
  id: number;
  content: string;
  createdAt: string;
}

export default function AdminSnackWishesPage() {
  const [wishes, setWishes] = useState<SnackWish[]>([]);

  async function load() {
    const res = await fetch("/api/snack-wishes");
    setWishes(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await adminFetch("/api/snack-wishes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function handleDeleteAll() {
    if (!confirm(`전체 ${wishes.length}개를 모두 삭제하시겠습니까?`)) return;
    await Promise.all(wishes.map((w) =>
      fetch("/api/snack-wishes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id }),
      })
    ));
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">간식 위시리스트 관리</h1>
      </div>

      <AdminGuide id="snack-wishes" title="간식 위시리스트 관리 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li>학생들이 공개 페이지(/check-fee 또는 학생회 안내)에서 제출한 간식 요청이 여기 모입니다 — <strong>읽기 + 삭제</strong> 전용입니다.</li>
          <li>구매·반영한 항목은 개별 <strong>삭제</strong>로 제거하세요.</li>
          <li>한 학기 단위로 정리할 때는 우측 상단 <strong>전체 삭제</strong> 사용.</li>
        </ol>
      </AdminGuide>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">총 {wishes.length}개</p>
        {wishes.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleDeleteAll}>
            전체 삭제
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {wishes.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">등록된 위시리스트가 없습니다.</p>
        )}
        {wishes.map((w, i) => (
          <Card key={w.id} className="border-border/60 rounded-xl">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
              <Cookie className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm flex-1">{w.content}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(w.createdAt).toLocaleDateString("ko-KR")}
              </span>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0 h-7 px-2"
                onClick={() => handleDelete(w.id)}>
                삭제
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

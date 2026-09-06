"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminGuide } from "@/components/admin-guide";

interface Row {
  id: number; slug: string; title: string; enabled: boolean;
  kind?: "goods" | "signup"; confirmEnabled?: boolean;
  opensAt: string | null; closesAt: string | null;
  orderCount: number; paidCount: number; confirmedCount?: number;
}

function statusOf(c: Row) {
  if (!c.enabled) return { label: "비공개", variant: "outline" as const };
  const now = Date.now();
  if (c.opensAt && new Date(c.opensAt).getTime() > now) return { label: "예정", variant: "secondary" as const };
  if (c.closesAt && new Date(c.closesAt).getTime() <= now) return { label: "마감", variant: "destructive" as const };
  return { label: "열림", variant: "default" as const };
}

export default function AdminCampaignsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.campaigns ?? data.rows ?? []);
  }
  useEffect(() => { Promise.resolve().then(load); }, []);

  async function post(body: object) {
    setBusy(true); setErr("");
    const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "생성 실패"); return; }
    router.push(`/admin/campaigns/${data.campaign?.id ?? data.id}`);
  }
  const create = () => title.trim() && slug.trim() && post({ title: title.trim(), slug: slug.trim().toLowerCase(), options: [] });
  const preset = () => post({ preset: "tshirt-2026-spring" });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</Link>
        <h1 className="text-2xl font-bold">학생회 이벤트 (신청·구매)</h1>
      </div>

      <AdminGuide id="campaigns" title="학생회 이벤트 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>새 캠페인</strong>: 제목과 주소(slug, 영문·숫자·하이픈)를 넣고 만들면 설정 화면으로 이동합니다. 공개 주소는 <code>/apply/주소</code>.</li>
          <li><strong>상반기 반팔티(수령 확인용)</strong> 버튼은 이미 배부한 반팔티의 수령 확인 캠페인을 옵션 14개와 함께 만듭니다. 만든 뒤 신청 목록 탭 → 「주문 적재」에 배부 시트 CSV를 넣으세요.</li>
          <li>메일에는 <code>/apply/주소/confirm</code> 링크를 넣습니다. 구매자가 받았어요/못 받았어요를 답하면 신청 목록에 응답 뱃지가 붙습니다.</li>
          <li><strong>신청 목록 탭</strong>에서 여러 건을 체크해 입금 확인·입금 취소·수령 완료를 한 번에 처리하고, 미응답 필터 → <strong>이메일 복사</strong>로 독촉 메일 대상을 뽑습니다.</li>
          <li>구글폼 대신 쓰는 화면입니다. 학번은 해시로만 저장되어 관리자에게도 보이지 않습니다.</li>
        </ol>
      </AdminGuide>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">새 캠페인</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1">
            <Label>제목</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026 하반기 반팔티 2차 구매" />
          </div>
          <div className="space-y-1">
            <Label>주소 (slug)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))} placeholder="tshirt-2026-2" />
          </div>
          <Button disabled={busy || !title.trim() || !slug.trim()} onClick={create}>만들기</Button>
          <div className="sm:col-span-3 flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={preset}>상반기 반팔티(수령 확인용) 만들기</Button>
            <span className="text-xs text-muted-foreground">주소 2026-spring-tshirt · 흰/검 × 7사이즈 · 수령 확인 9/13 마감</span>
          </div>
          {err && <p className="text-sm text-destructive sm:col-span-3">{err}</p>}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-3">캠페인 ({rows.length})</h2>
      <div className="space-y-2">
        {rows.map((c) => {
          const s = statusOf(c);
          return (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium">{c.title}</span>
                    <Badge variant="outline" className="text-xs">{c.kind === "goods" ? "굿즈" : "신청"}</Badge>
                    <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                    {c.confirmEnabled && <Badge variant="secondary" className="text-xs">수령 확인 중</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    /apply/{c.slug} · 신청 {c.orderCount}건 · 입금 {c.paidCount}건
                    {c.confirmEnabled && typeof c.confirmedCount === "number" && ` · 확인 응답 ${c.confirmedCount}/${c.orderCount}`}
                    {c.closesAt && ` · 마감 ${new Date(c.closesAt).toLocaleString("ko-KR")}`}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => router.push(`/admin/campaigns/${c.id}`)}>관리</Button>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">아직 캠페인이 없습니다.</p>}
      </div>
    </div>
  );
}

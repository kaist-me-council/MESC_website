"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminGuide } from "@/components/admin-guide";
import { SettingsTab } from "./settings-tab";
import { OrdersTab } from "./orders-tab";
import type { Campaign, Order } from "./types";

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 초기 탭은 주소(?tab=)에서. lazy initializer 라 effect 안 setState 가 아님
  const [tab, setTabState] = useState<"settings" | "orders">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "settings" ? "settings" : "orders");
  // 탭을 주소(?tab=)에 남겨 새로고침·뒤로가기에도 유지
  const setTab = (t: "settings" | "orders") => {
    setTabState(t);
    const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u.toString());
  };
  const [c, setC] = useState<Campaign | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    const res = await fetch(`/api/admin/campaigns/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const camp: Campaign = data.campaign ?? data;
    setC({
      ...camp,
      kind: camp.kind ?? "signup",
      imageUrl: camp.imageUrl ?? null,
      confirmEnabled: camp.confirmEnabled ?? false,
      confirmDeadline: camp.confirmDeadline ?? null,
      confirmNote: camp.confirmNote ?? null,
      confirmNoteEn: camp.confirmNoteEn ?? null,
      options: (camp.options ?? []).map((o) => ({ ...o, group: o.group ?? "", nameEn: o.nameEn ?? "" })),
    });
  }
  async function loadOrders() {
    const res = await fetch(`/api/admin/campaigns/${id}/orders`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.orders ?? []);
  }
  useEffect(() => { Promise.resolve().then(() => { load(); loadOrders(); }); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <div className="container mx-auto px-4 py-8 max-w-5xl text-sm text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:text-foreground">← 캠페인 목록</Link>
        <h1 className="text-2xl font-bold truncate">{c.title}</h1>
        <Badge variant="outline" className="text-xs">{c.kind === "goods" ? "굿즈" : "신청"}</Badge>
        <a className="text-sm underline text-muted-foreground" href={`/apply/${c.slug}`} target="_blank" rel="noreferrer">/apply/{c.slug}</a>
        {c.confirmEnabled && <a className="text-sm underline text-muted-foreground" href={`/apply/${c.slug}/confirm`} target="_blank" rel="noreferrer">수령 확인 페이지</a>}
      </div>

      <AdminGuide id={`campaign-${c.id}`} title="캠페인 관리 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>설정</strong>: 종류(굿즈/신청)·기간·계좌·옵션을 채우고 <strong>공개</strong>를 켠 뒤 <strong>저장</strong>. 굿즈는 그룹=색상, 이름=사이즈로 넣으면 상품형 화면이 됩니다.</li>
          <li><strong>주문 적재</strong>: 이미 끝난 구매(배부 시트)는 신청 목록 탭의 「주문 적재」로 넣습니다. 픽업 O는 수령, X는 입금 상태로 들어갑니다.</li>
          <li><strong>수령 확인</strong>을 켜면 <code>/apply/주소/confirm</code>에서 구매자가 받았어요/못 받았어요를 답합니다. 메일에는 이 주소를 넣으세요.</li>
          <li><strong>신청 목록</strong>: 체크박스로 여러 건을 골라 입금 확인·입금 취소·수령 완료를 한 번에. 미응답 필터 → <strong>이메일 복사</strong> → Gmail 받는 사람에 붙여넣기.</li>
          <li><strong>못 받음 집계</strong>가 사이즈별 부족량, <strong>옵션별 합계</strong>가 발주표입니다. CSV로 정산 명단을 뽑으세요.</li>
        </ol>
      </AdminGuide>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === "orders" ? "default" : "outline"} size="sm" onClick={() => setTab("orders")}>신청 목록 ({orders.length})</Button>
        <Button variant={tab === "settings" ? "default" : "outline"} size="sm" onClick={() => setTab("settings")}>설정</Button>
      </div>

      {tab === "settings"
        ? <SettingsTab c={c} setC={setC} onSaved={load} />
        : <OrdersTab c={c} orders={orders} reload={loadOrders} />}
    </div>
  );
}

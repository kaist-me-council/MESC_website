"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminGuide } from "@/components/admin-guide";
import { SettingsTab } from "./settings-tab";
import { OrdersTab } from "./orders-tab";
import { ConfirmTab } from "./confirm-tab";
import { ImportSection } from "./import-section";
import { AlertTriangle } from "lucide-react";
import type { Campaign, Order } from "./types";

type Tab = "orders" | "confirm" | "settings" | "import";
const TABS: Tab[] = ["orders", "confirm", "settings", "import"];
/** 상태 문구는 모듈 스코프에서 계산한다 (렌더 중 Date.now 직접 호출 금지) */
function openStateOf(c: Campaign): string {
  if (!c.enabled) return "비공개";
  const now = Date.now();
  if (c.opensAt && new Date(c.opensAt).getTime() > now) return "접수 예정";
  if (c.closesAt && new Date(c.closesAt).getTime() <= now) return "접수 마감";
  return "접수 중";
}
/**
 * 지금 학생이 들어오면 신청이 안 되는 상태인지 알려 준다.
 * (공개·접수 중인데 고를 옵션이 하나도 없으면 폼이 열려 있어도 제출이 막힌다 — 눈에 띄어야 한다)
 */
function blockerOf(c: Campaign): string | null {
  if (openStateOf(c) !== "접수 중") return null;
  const usable = c.options.filter((o) => o.enabled);
  if (!usable.length) return "지금 공개돼 있지만 선택할 옵션이 없어 학생이 신청할 수 없습니다. 아래 설정 탭에서 옵션을 추가하세요.";
  if (usable.every((o) => o.stock !== null && o.stock <= 0)) return "모든 옵션이 품절이라 신청할 수 없습니다.";
  return null;
}
function confirmStateOf(c: Campaign): string | null {
  if (!c.confirmEnabled) return null;
  return c.confirmDeadline && new Date(c.confirmDeadline).getTime() <= Date.now() ? "수령 확인 마감" : "수령 확인 중";
}

const readTab = (): Tab => {
  if (typeof window === "undefined") return "orders";
  const t = new URLSearchParams(window.location.search).get("tab");
  return (TABS as string[]).includes(t ?? "") ? (t as Tab) : "orders";
};

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 초기 탭은 주소(?tab=)에서. lazy initializer 라 effect 안 setState 가 아님
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab) => {
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

  if (!c) return <div className="py-8 text-sm text-muted-foreground">불러오는 중...</div>;

  const openState = openStateOf(c);
  const confirmState = confirmStateOf(c);
  const blocker = blockerOf(c);
  const importCount = orders.filter((o) => o.source === "import").length;
  const unconfirmed = orders.filter((o) => o.status !== "cancelled" && !o.confirmation).length;

  const tabs: [Tab, string][] = [
    ["orders", `신청 목록 (${orders.length})`],
    ...(c.confirmEnabled ? ([["confirm", `수령 확인 (미응답 ${unconfirmed})`]] as [Tab, string][]) : []),
    ["settings", "설정"],
    ["import", "데이터 가져오기"],
  ];

  return (
    <div className="py-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:text-foreground">← 캠페인 목록</Link>
        <h1 className="text-2xl font-bold truncate">{c.title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <Badge variant="outline" className="text-xs">{c.kind === "goods" ? "굿즈" : "신청"}</Badge>
        <Badge variant={c.enabled ? "default" : "outline"} className="text-xs">{openState}</Badge>
        {confirmState && <Badge variant="secondary" className="text-xs">{confirmState}</Badge>}
        <a className="underline text-muted-foreground" href={`/apply/${c.slug}`} target="_blank" rel="noreferrer">{c.enabled ? "공개 페이지 보기" : "미리보기 (비공개 — 관리자만 보임)"}</a>
        {c.confirmEnabled && <a className="underline text-muted-foreground" href={`/apply/${c.slug}/confirm`} target="_blank" rel="noreferrer">수령 확인 페이지</a>}
      </div>

      {blocker && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          <span>{blocker}</span>
        </div>
      )}

      <AdminGuide id={`campaign-${c.id}`} title="캠페인 관리 사용법">
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>신청 목록</strong>: 입금 확인·수령 처리·항목 수정. 체크박스로 여러 건을 한 번에 처리하고, 필터를 바꾸면 선택은 초기화됩니다.</li>
          <li><strong>수령 확인</strong>: 미응답·받음·못 받음을 보고, 못 받음 집계로 부족 수량을 확인한 뒤 처리 완료로 정리합니다. 미응답 필터 → 이메일 복사 → Gmail 독촉.</li>
          <li><strong>설정</strong>: 종류·기간·계좌·옵션·이미지. 굿즈는 그룹=색상, 이름=사이즈로 넣으면 상품형 화면이 됩니다.</li>
          <li><strong>데이터 가져오기</strong>: 이미 끝난 구매(배부 시트)를 주문으로 넣습니다. 미리보기에서 문제가 없을 때만 적재할 수 있습니다.</li>
        </ol>
      </AdminGuide>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(([k, label]) => (
          <Button key={k} variant={tab === k ? "default" : "outline"} size="sm" onClick={() => setTab(k)}>{label}</Button>
        ))}
      </div>

      {tab === "orders" && <OrdersTab c={c} orders={orders} reload={loadOrders} />}
      {tab === "confirm" && <ConfirmTab c={c} orders={orders} reload={loadOrders} />}
      {tab === "settings" && <SettingsTab c={c} setC={(fn) => setC((prev) => (prev ? fn(prev) : prev))} onSaved={load} />}
      {tab === "import" && (
        <div className="space-y-4">
          <ImportSection campaignId={c.id} importCount={importCount} onDone={loadOrders} />
          <a className="text-sm underline" href={`/api/admin/campaigns/${c.id}/orders?format=csv`}>전체 CSV 내보내기 ({orders.length}건)</a>
        </div>
      )}
    </div>
  );
}

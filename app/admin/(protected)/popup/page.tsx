"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus, Trash2 } from "lucide-react";

interface PopupLink {
  id: number;
  label: string;
  labelEn: string | null;
  url: string;
  icon: string | null;
  order: number;
  enabled: boolean;
}

interface Settings {
  enabled: boolean;
  title: string;
  message: string | null;
}

export default function AdminPopupPage() {
  const [settings, setSettings] = useState<Settings>({ enabled: false, title: "기계공학과 학생회", message: "" });
  const [links, setLinks] = useState<PopupLink[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newLabelEn, setNewLabelEn] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [settingsRes, linksRes] = await Promise.all([
      fetch("/api/popup"),
      fetch("/api/popup/links"),
    ]);
    const settingsData = await settingsRes.json();
    setSettings({
      enabled: settingsData.enabled,
      title: settingsData.title ?? "기계공학과 학생회",
      message: settingsData.message ?? "",
    });
    if (linksRes.ok) setLinks(await linksRes.json());
  }

  useEffect(() => { load(); }, []);

  async function saveSettings() {
    setError(""); setSavedMsg("");
    const res = await fetch("/api/popup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSavedMsg("설정이 저장되었습니다.");
      setTimeout(() => setSavedMsg(""), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "저장 실패");
    }
  }

  async function addOrUpdateLink() {
    setError("");
    const payload = {
      label: newLabel.trim(),
      labelEn: newLabelEn.trim() || null,
      url: newUrl.trim(),
      icon: newIcon.trim() || null,
    };
    if (!payload.label || !payload.url) {
      setError("라벨과 URL은 필수입니다.");
      return;
    }
    const res = editingId !== null
      ? await fetch(`/api/popup/links/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/popup/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "오류 발생");
      return;
    }
    resetLinkForm();
    load();
  }

  function resetLinkForm() {
    setEditingId(null); setNewLabel(""); setNewLabelEn(""); setNewUrl(""); setNewIcon(""); setError("");
  }

  function startEdit(link: PopupLink) {
    setEditingId(link.id);
    setNewLabel(link.label);
    setNewLabelEn(link.labelEn ?? "");
    setNewUrl(link.url);
    setNewIcon(link.icon ?? "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function toggleLink(id: number, enabled: boolean) {
    await fetch(`/api/popup/links/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function deleteLink(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/popup/links/${id}`, { method: "DELETE" });
    if (editingId === id) resetLinkForm();
    load();
  }

  async function changeOrder(id: number, delta: number) {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    await fetch(`/api/popup/links/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: link.order + delta }),
    });
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">홈화면 팝업 관리</h1>
      </div>

      {/* 팝업 ON/OFF + 제목/메시지 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">팝업 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <Checkbox
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: !!v })}
            />
            <div className="flex-1">
              <Label htmlFor="enabled" className="font-semibold cursor-pointer">팝업 활성화</Label>
              <p className="text-xs text-muted-foreground mt-1">
                활성화 시 홈화면 첫 방문자에게 자동으로 팝업이 표시됩니다.
                "오늘 그만 보기"를 누르면 24시간 동안 미표시.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>팝업 제목</Label>
            <Input
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              placeholder="기계공학과 학생회"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>안내 메시지 (선택)</Label>
            <Input
              value={settings.message ?? ""}
              onChange={(e) => setSettings({ ...settings, message: e.target.value })}
              placeholder="아래 링크에서 학생회 채널을 확인하세요!"
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            {savedMsg && <span className="text-xs text-green-600 dark:text-green-400">{savedMsg}</span>}
            <Button onClick={saveSettings}>설정 저장</Button>
          </div>
        </CardContent>
      </Card>

      {/* 링크 추가/수정 폼 */}
      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? <span className="text-primary">✏️ 링크 수정 중</span> : "새 링크 추가"}
              {editingId !== null && <Button variant="ghost" size="sm" onClick={resetLinkForm}>취소</Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>라벨 (한국어)</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="카카오톡 채널" />
              </div>
              <div className="space-y-2">
                <Label>라벨 (영어, 선택)</Label>
                <Input value={newLabelEn} onChange={(e) => setNewLabelEn(e.target.value)} placeholder="KakaoTalk" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="http://pf.kakao.com/_fHXxkn/chat" />
            </div>
            <div className="space-y-2">
              <Label>아이콘 (이모지, 선택)</Label>
              <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="💬" maxLength={20} />
            </div>
            <Button onClick={addOrUpdateLink} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {editingId !== null ? "수정 저장" : "링크 추가"}
            </Button>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      {/* 등록된 링크 목록 */}
      <h2 className="text-lg font-semibold mb-4">등록된 링크 ({links.length}개)</h2>
      {links.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">등록된 링크가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <Card key={link.id} className={editingId === link.id ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <Checkbox
                  checked={link.enabled}
                  onCheckedChange={(v) => toggleLink(link.id, !!v)}
                />
                {link.icon && <span className="text-xl shrink-0">{link.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{link.label}</p>
                    {!link.enabled && <Badge variant="outline" className="text-xs">비활성</Badge>}
                  </div>
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {link.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => changeOrder(link.id, -1)} className="h-7 w-7 p-0">↑</Button>
                  <Button variant="ghost" size="sm" onClick={() => changeOrder(link.id, 1)} className="h-7 w-7 p-0">↓</Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(link)} disabled={editingId === link.id}>수정</Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteLink(link.id)} className="text-destructive hover:text-destructive h-7 px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

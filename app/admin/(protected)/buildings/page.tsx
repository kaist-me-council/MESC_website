"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Plus, Trash2, Upload } from "lucide-react";

interface Floor {
  id: number;
  level: number;
  imageUrl: string | null;
  description: string | null;
  professors: Array<{ id: number; name: string }>;
}

interface Building {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  order: number;
  floors: Floor[];
}

export default function AdminBuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [floorLevel, setFloorLevel] = useState("");
  const [floorDesc, setFloorDesc] = useState("");
  const [floorImageUrl, setFloorImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/buildings");
    setBuildings(await res.json());
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setCode(""); setName(""); setNameEn(""); setDescription(""); setEditingId(null); setError("");
  }

  function startEdit(b: Building) {
    setEditingId(b.id);
    setCode(b.code); setName(b.name); setNameEn(b.nameEn ?? ""); setDescription(b.description ?? "");
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveBuilding() {
    setError("");
    const payload = { code: code.trim(), name: name.trim(), nameEn: nameEn.trim() || null, description: description.trim() || null };
    if (!payload.code || !payload.name) {
      setError("코드와 이름은 필수입니다.");
      return;
    }
    const res = editingId !== null
      ? await fetch(`/api/buildings/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/buildings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "저장 실패");
      return;
    }
    reset();
    load();
  }

  async function deleteBuilding(id: number) {
    if (!confirm("건물을 삭제하시겠습니까? 포함된 모든 층 정보가 함께 삭제됩니다.")) return;
    await fetch(`/api/buildings/${id}`, { method: "DELETE" });
    if (selectedBuildingId === id) setSelectedBuildingId(null);
    if (editingId === id) reset();
    load();
  }

  async function uploadFloorImage(file: File) {
    setUploading(true);
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) setFloorImageUrl(data.url);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addFloor() {
    if (!selectedBuildingId) return;
    const level = parseInt(floorLevel);
    if (isNaN(level)) { alert("층 번호를 입력하세요."); return; }
    const res = await fetch(`/api/buildings/${selectedBuildingId}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, imageUrl: floorImageUrl || null, description: floorDesc.trim() || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "추가 실패");
      return;
    }
    setFloorLevel(""); setFloorDesc(""); setFloorImageUrl("");
    load();
  }

  async function updateFloor(floorId: number, patch: { description?: string; imageUrl?: string }) {
    await fetch(`/api/buildings/floors/${floorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function deleteFloor(floorId: number) {
    if (!confirm("층을 삭제하시겠습니까?")) return;
    await fetch(`/api/buildings/floors/${floorId}`, { method: "DELETE" });
    load();
  }

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">건물·평면도 관리</h1>
      </div>

      {/* 건물 추가/수정 폼 */}
      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? <span className="text-primary">✏️ 건물 수정 중</span> : "새 건물 추가"}
              {editingId !== null && <Button variant="ghost" size="sm" onClick={reset}>취소</Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>코드 *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="N7" maxLength={10} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>이름 *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="기계공학동" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>영문 이름 (선택)</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Mechanical Engineering Building" />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button onClick={saveBuilding} className="w-full">
              {editingId !== null ? "수정 저장" : "건물 추가"}
            </Button>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      {/* 등록 건물 목록 */}
      <h2 className="text-lg font-semibold mb-4">등록 건물 ({buildings.length}개)</h2>
      <div className="space-y-3 mb-8">
        {buildings.map((b) => (
          <Card key={b.id} className={editingId === b.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    <Badge variant="outline" className="mr-2">{b.code}</Badge>
                    {b.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{b.floors.length}개 층 등록됨</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setSelectedBuildingId(b.id === selectedBuildingId ? null : b.id)}>
                  층 관리
                </Button>
                <Button variant="outline" size="sm" onClick={() => startEdit(b)} disabled={editingId === b.id}>수정</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteBuilding(b.id)}>삭제</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 층 관리 패널 */}
      {selectedBuilding && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {selectedBuilding.code} {selectedBuilding.name} 층 관리
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBuildingId(null)}>닫기</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 새 층 추가 */}
            <div className="p-4 rounded-lg bg-muted/40 space-y-3">
              <p className="text-sm font-semibold">+ 새 층 추가</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">층 (예: 3)</Label>
                  <Input type="number" value={floorLevel} onChange={(e) => setFloorLevel(e.target.value)} placeholder="3" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">통로 안내 (선택)</Label>
                  <Input value={floorDesc} onChange={(e) => setFloorDesc(e.target.value)} placeholder="W8동 3층과 연결됨" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">평면도 이미지</Label>
                <div className="flex gap-2">
                  <Input value={floorImageUrl} onChange={(e) => setFloorImageUrl(e.target.value)} placeholder="URL 또는 파일 업로드" className="flex-1 text-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFloorImage(f); }} />
                </div>
                {floorImageUrl && (
                  <div className="relative w-full max-h-32 overflow-hidden rounded-lg bg-muted mt-1">
                    <img src={floorImageUrl} alt="미리보기" className="w-full h-auto object-contain" />
                  </div>
                )}
              </div>
              <Button onClick={addFloor} className="w-full gap-2" size="sm">
                <Plus className="h-4 w-4" /> 층 추가
              </Button>
            </div>

            {/* 등록된 층 목록 */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">등록된 층</p>
              {selectedBuilding.floors.length === 0 ? (
                <p className="text-xs text-muted-foreground">아직 등록된 층이 없습니다.</p>
              ) : (
                selectedBuilding.floors.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{f.level}F</Badge>
                      <Button variant="ghost" size="sm" onClick={() => deleteFloor(f.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {f.imageUrl && (
                      <img src={f.imageUrl} alt="" className="w-full h-32 object-contain bg-muted rounded" />
                    )}
                    <Input
                      defaultValue={f.description ?? ""}
                      placeholder="통로 안내 메시지"
                      onBlur={(e) => {
                        if (e.target.value !== (f.description ?? "")) {
                          updateFloor(f.id, { description: e.target.value });
                        }
                      }}
                      className="text-xs"
                    />
                    <p className="text-xs text-muted-foreground">교수님 {f.professors.length}명</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

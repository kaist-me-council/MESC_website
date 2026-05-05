"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, User } from "lucide-react";
import Image from "next/image";

interface Professor {
  id: number;
  name: string;
  nameEn: string | null;
  title: string;
  buildingId: number | null;
  building: { id: number; code: string; name: string } | null;
  floorId: number | null;
  floor: { id: number; level: number } | null;
  roomNumber: string | null;
  email: string | null;
  phone: string | null;
  researchArea: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  order: number;
}

interface BuildingForm {
  id: number;
  code: string;
  name: string;
  floors: Array<{ id: number; level: number }>;
}

const initial = {
  name: "", nameEn: "", title: "교수",
  buildingId: "", floorId: "", roomNumber: "",
  email: "", phone: "", researchArea: "", websiteUrl: "", imageUrl: "",
  order: "0",
};

export default function AdminProfessorsPage() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [buildings, setBuildings] = useState<BuildingForm[]>([]);
  const [form, setForm] = useState(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [pRes, bRes] = await Promise.all([fetch("/api/professors"), fetch("/api/buildings")]);
    setProfessors(await pRes.json());
    setBuildings(await bRes.json());
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setForm(initial); setEditingId(null); setError("");
  }

  function startEdit(p: Professor) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      nameEn: p.nameEn ?? "",
      title: p.title,
      buildingId: p.buildingId?.toString() ?? "",
      floorId: p.floorId?.toString() ?? "",
      roomNumber: p.roomNumber ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      researchArea: p.researchArea ?? "",
      websiteUrl: p.websiteUrl ?? "",
      imageUrl: p.imageUrl ?? "",
      order: p.order.toString(),
    });
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setForm({ ...form, imageUrl: data.url });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    setError("");
    if (!form.name.trim()) { setError("이름은 필수입니다."); return; }

    const payload = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || null,
      title: form.title.trim() || "교수",
      buildingId: form.buildingId ? parseInt(form.buildingId) : null,
      floorId: form.floorId ? parseInt(form.floorId) : null,
      roomNumber: form.roomNumber.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      researchArea: form.researchArea.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      order: parseInt(form.order) || 0,
    };

    const res = editingId !== null
      ? await fetch(`/api/professors/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/professors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "저장 실패");
      return;
    }
    reset();
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/professors/${id}`, { method: "DELETE" });
    if (editingId === id) reset();
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return professors;
    return professors.filter((p) => p.name.toLowerCase().includes(q) || (p.nameEn?.toLowerCase().includes(q) ?? false));
  }, [professors, search]);

  // 선택된 건물의 층 목록
  const availableFloors = useMemo(() => {
    if (!form.buildingId) return [];
    const b = buildings.find((b) => b.id === parseInt(form.buildingId));
    return b?.floors ?? [];
  }, [form.buildingId, buildings]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">교수님 관리</h1>
      </div>

      <div ref={formRef}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {editingId !== null ? <span className="text-primary">✏️ 교수님 수정 중</span> : "새 교수님 추가"}
              {editingId !== null && <Button variant="ghost" size="sm" onClick={reset}>취소</Button>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>이름 *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" />
              </div>
              <div className="space-y-2">
                <Label>영문 이름</Label>
                <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Hong Gildong" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>직위</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="교수" />
              </div>
              <div className="space-y-2">
                <Label>호실</Label>
                <Input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="3301" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>건물</Label>
                <select
                  value={form.buildingId}
                  onChange={(e) => setForm({ ...form, buildingId: e.target.value, floorId: "" })}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">선택 안함</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} {b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>층</Label>
                <select
                  value={form.floorId}
                  onChange={(e) => setForm({ ...form, floorId: e.target.value })}
                  disabled={!form.buildingId}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                >
                  <option value="">선택 안함</option>
                  {availableFloors.map((f) => (
                    <option key={f.id} value={f.id}>{f.level}F</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>이메일</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="prof@kaist.ac.kr" />
              </div>
              <div className="space-y-2">
                <Label>전화</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="042-350-XXXX" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>연구 분야</Label>
              <Input value={form.researchArea} onChange={(e) => setForm({ ...form, researchArea: e.target.value })} placeholder="유체역학, 열공학..." />
            </div>
            <div className="space-y-2">
              <Label>웹사이트 URL</Label>
              <Input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>사진</Label>
              <div className="flex gap-2">
                <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="URL 또는 파일 업로드" className="flex-1 text-xs" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
              </div>
              {form.imageUrl && (
                <Image src={form.imageUrl} alt="" width={80} height={80} className="rounded-full object-cover mt-2 border border-border" />
              )}
            </div>
            <div className="space-y-2">
              <Label>정렬 순서</Label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
            <Button onClick={save} className="w-full">{editingId !== null ? "수정 저장" : "교수님 추가"}</Button>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <Input placeholder="이름 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <h2 className="text-lg font-semibold mb-4">등록된 교수님 ({filtered.length}명)</h2>
      <div className="space-y-2">
        {filtered.map((p) => (
          <Card key={p.id} className={editingId === p.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt="" width={40} height={40} className="rounded-full object-cover shrink-0 border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.name} {p.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.building?.code ?? "-"} {p.floor && `· ${p.floor.level}F`} · {p.roomNumber ?? "-"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => startEdit(p)} disabled={editingId === p.id}>수정</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>삭제</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

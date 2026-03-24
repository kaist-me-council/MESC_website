"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";

interface Member {
  id: number;
  name: string;
  role: string;
  bureau: string;
  imageUrl: string | null;
  order: number;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bureau, setBureau] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [order, setOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function loadMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(data);
  }

  useEffect(() => { loadMembers(); }, []);

  async function handleSubmit() {
    if (!name.trim() || !role.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, bureau, imageUrl: imageUrl || null, order: Number(order) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? `오류가 발생했습니다. (${res.status})`);
        setSubmitting(false);
        return;
      }
      setName(""); setRole(""); setBureau(""); setImageUrl(""); setOrder("0");
      loadMembers();
    } catch (e) {
      setSubmitError("네트워크 오류가 발생했습니다.");
    }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    loadMembers();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← 대시보드</a>
        <h1 className="text-2xl font-bold">학생회 멤버 관리</h1>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">새 멤버 추가</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="space-y-2">
              <Label>직위 (직책)</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="회장, 국장, 국원 등" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>국 (선택) — 없으면 비워두세요</Label>
            <Input value={bureau} onChange={(e) => setBureau(e.target.value)} placeholder="사무국, 홍보미디어국, 학술국, 복지국 등" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>사진 URL (선택)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>정렬 순서 (낮을수록 앞)</Label>
              <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "추가 중..." : "멤버 추가"}
          </Button>
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-4">등록된 멤버 ({members.length}명)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {members.map((member) => (
          <Card key={member.id} className="relative">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted">
                {member.imageUrl ? (
                  <Image src={member.imageUrl} alt={member.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
                {member.bureau && <p className="text-xs text-primary/70">{member.bureau}</p>}
                <p className="text-xs text-muted-foreground">순서: {member.order}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => handleDelete(member.id)}
              >
                삭제
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

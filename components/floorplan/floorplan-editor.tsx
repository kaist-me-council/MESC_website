"use client";

import { useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { MapPin, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface EditorProfessor {
  id: number;
  name: string;
  roomNumber?: string | null;
  posX?: number | null;
  posY?: number | null;
}

export interface EditorFloor {
  id: number;
  level: number;
  imageUrl: string | null;
  width?: number | null;
  height?: number | null;
}

interface Props {
  floor: EditorFloor;
  professors: EditorProfessor[];
  /** 좌표 PATCH 호출자 — Promise 반환 */
  onSave: (professorId: number, posX: number | null, posY: number | null) => Promise<void>;
}

/**
 * 평면도 위에서 교수님 핀 위치를 편집한다.
 *   - 좌측: 교수 목록 (이미 배치됨 / 미배치)
 *   - 우측: 평면도 + 기존 핀 표시 + "배치 모드 ON" 시 이미지 클릭 → 좌표 저장
 *   - 배치 모드 OFF 일 때는 줌·팬만
 */
export function FloorplanEditor({ floor, professors, onSave }: Props) {
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  // 이미지 자연 종횡비 → 컨테이너 반영 (뷰어와 동일, 레터박싱 제거). width/height 폴백, 없으면 16:10
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const t = e.currentTarget;
    if (t.naturalWidth && t.naturalHeight) setImgAspect(t.naturalWidth / t.naturalHeight);
  }

  const placed = professors.filter((p) => p.posX != null && p.posY != null);
  const unplaced = professors.filter((p) => p.posX == null || p.posY == null);

  async function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!placeMode || !selectedProfId) return;
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setSaving(selectedProfId);
    try {
      await onSave(selectedProfId, x, y);
    } finally {
      setSaving(null);
    }
  }

  async function clearPin(profId: number) {
    setSaving(profId);
    try {
      await onSave(profId, null, null);
    } finally {
      setSaving(null);
    }
  }

  if (!floor.imageUrl) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        평면도 이미지를 먼저 업로드해야 핀 배치가 가능합니다.
      </div>
    );
  }

  const aspect = imgAspect ?? (floor.width && floor.height ? floor.width / floor.height : 16 / 10);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      {/* 좌측: 교수 목록 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{placed.length}/{professors.length} 배치됨</span>
          <Button
            size="sm"
            variant={placeMode ? "default" : "outline"}
            onClick={() => setPlaceMode((v) => !v)}
            disabled={!selectedProfId}
          >
            {placeMode ? "배치 모드 ON" : "배치 모드"}
          </Button>
        </div>

        {unplaced.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">미배치</p>
            <div className="space-y-1">
              {unplaced.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProfId(p.id);
                    setPlaceMode(true);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors ${
                    selectedProfId === p.id ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="truncate">
                    {p.name} {p.roomNumber && <span className="text-muted-foreground">({p.roomNumber}호)</span>}
                  </span>
                  {saving === p.id && <Loader2 className="h-3 w-3 animate-spin" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {placed.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">배치 완료</p>
            <div className="space-y-1">
              {placed.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm ${
                    selectedProfId === p.id ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted/60"
                  }`}
                >
                  <button onClick={() => { setSelectedProfId(p.id); setPlaceMode(true); }} className="truncate flex-1 text-left flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    {p.name}
                  </button>
                  <button
                    onClick={() => clearPin(p.id)}
                    disabled={saving === p.id}
                    className="text-muted-foreground hover:text-destructive"
                    title="위치 제거"
                  >
                    {saving === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {placeMode && selectedProfId && (
          <p className="text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 leading-relaxed">
            평면도 위에서 <strong>{professors.find(p => p.id === selectedProfId)?.name}</strong> 의 위치를 클릭하세요. 다시 클릭하면 위치가 갱신됩니다.
          </p>
        )}
      </div>

      {/* 우측: 평면도 — 배치 모드일 땐 줌/팬 우회 (클릭이 핀 좌표 입력으로) */}
      <div className="rounded-xl overflow-hidden border border-border bg-muted/40 relative" style={{ aspectRatio: aspect }}>
        {placeMode ? (
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={floor.imageUrl}
              alt={`${floor.level}층 평면도`}
              className="w-full h-full object-contain select-none cursor-crosshair"
              draggable={false}
              onClick={handleImageClick}
              onLoad={handleImgLoad}
            />
            {placed.map((p) => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
                style={{ left: `${(p.posX ?? 0) * 100}%`, top: `${(p.posY ?? 0) * 100}%` }}
              >
                <MapPin
                  className={`h-7 w-7 drop-shadow-md ${selectedProfId === p.id ? "text-blue-500" : "text-red-500"}`}
                  fill="currentColor"
                />
                <Badge variant="secondary" className="absolute left-1/2 -translate-x-1/2 -top-6 text-[10px] whitespace-nowrap shadow">
                  {p.name}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <TransformWrapper
            minScale={0.6}
            maxScale={5}
            initialScale={1}
            centerOnInit
            wheel={{ step: 0.15 }}
            pinch={{ step: 5 }}
          >
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={floor.imageUrl}
                  alt={`${floor.level}층 평면도`}
                  className="w-full h-full object-contain select-none pointer-events-none"
                  draggable={false}
                  onLoad={handleImgLoad}
                />
                {placed.map((p) => (
                  <div
                    key={p.id}
                    className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
                    style={{ left: `${(p.posX ?? 0) * 100}%`, top: `${(p.posY ?? 0) * 100}%` }}
                  >
                    <MapPin
                      className={`h-7 w-7 drop-shadow-md ${selectedProfId === p.id ? "text-blue-500" : "text-red-500"}`}
                      fill="currentColor"
                    />
                    <Badge variant="secondary" className="absolute left-1/2 -translate-x-1/2 -top-6 text-[10px] whitespace-nowrap shadow">
                      {p.name}
                    </Badge>
                  </div>
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { MapPin, X, Mail, Phone, BookOpen, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ViewerProfessor {
  id: number;
  name: string;
  nameEn?: string | null;
  title?: string | null;
  roomNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  researchArea?: string | null;
  websiteUrl?: string | null;
  posX?: number | null;
  posY?: number | null;
}

export interface ViewerFloor {
  id: number;
  level: number;
  imageUrl: string | null;
  width?: number | null;
  height?: number | null;
}

interface Props {
  floor: ViewerFloor;
  professors: ViewerProfessor[];
}

/**
 * 평면도 + 교수실 핀 + 줌·팬.
 * react-zoom-pan-pinch 의 TransformWrapper 안에 이미지와 핀 모두 absolute 로 배치.
 * 핀 클릭 시 우측 패널에 교수 정보 표시 (모바일에선 하단 시트로 변환).
 */
export function FloorplanViewer({ floor, professors }: Props) {
  const [selected, setSelected] = useState<ViewerProfessor | null>(null);
  // 이미지 로드 시 자연 종횡비를 읽어 컨테이너에 반영 → 레터박싱(회색 여백) 제거.
  // (DB width/height 는 폴백, 없으면 16:10)
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const pinned = professors.filter((p) => p.posX != null && p.posY != null);

  if (!floor.imageUrl) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        이 층의 평면도가 아직 업로드되지 않았습니다.
      </div>
    );
  }

  const aspect = imgAspect ?? (floor.width && floor.height ? floor.width / floor.height : 16 / 10);

  return (
    <div className="relative w-full">
      <div className="rounded-xl overflow-hidden border border-border bg-muted/40 relative" style={{ aspectRatio: aspect }}>
        <TransformWrapper
          minScale={0.6}
          maxScale={5}
          initialScale={1}
          centerOnInit
          doubleClick={{ mode: "toggle", step: 1 }}
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          panning={{ disabled: false }}
        >
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
            <div className="relative w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={floor.imageUrl}
                alt={`${floor.level}층 평면도`}
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
                onLoad={(e) => {
                  const t = e.currentTarget;
                  if (t.naturalWidth && t.naturalHeight) setImgAspect(t.naturalWidth / t.naturalHeight);
                }}
              />
              {pinned.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="absolute -translate-x-1/2 -translate-y-full group"
                  style={{ left: `${(p.posX ?? 0) * 100}%`, top: `${(p.posY ?? 0) * 100}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(p);
                  }}
                  title={p.name}
                >
                  <MapPin className="h-7 w-7 text-red-500 drop-shadow-md group-hover:scale-110 transition-transform" fill="currentColor" />
                  <span className="absolute left-1/2 -translate-x-1/2 -top-6 whitespace-nowrap text-xs font-semibold bg-background/90 backdrop-blur px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* 핀 안내 */}
      {pinned.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-red-500" fill="currentColor" />
          핀 {pinned.length}개 — 핀 클릭으로 교수님 정보. 휠/핀치로 줌, 드래그로 이동.
        </p>
      )}

      {/* 교수 정보 모달 (오버레이) */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 -m-2 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(null)}
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-3 mb-3">
              <div>
                <h3 className="text-lg font-bold">{selected.name}</h3>
                {selected.nameEn && <p className="text-xs text-muted-foreground">{selected.nameEn}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {selected.title && <Badge variant="outline">{selected.title}</Badge>}
                  {selected.roomNumber && <Badge variant="secondary">{selected.roomNumber}호</Badge>}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {selected.researchArea && (
                <p className="flex items-start gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{selected.researchArea}</span>
                </p>
              )}
              {selected.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${selected.email}`} className="text-primary hover:underline">
                    {selected.email}
                  </a>
                </p>
              )}
              {selected.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${selected.phone}`} className="text-primary hover:underline">
                    {selected.phone}
                  </a>
                </p>
              )}
              {selected.websiteUrl && (
                <p className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={selected.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate min-w-0">
                    {selected.websiteUrl}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

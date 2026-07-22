"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { X, Mail, Phone, BookOpen, ExternalLink, Search, User, DoorClosed } from "lucide-react";
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

export interface ViewerRoom {
  id: number;
  code: string;
  name?: string | null;
  posX?: number | null;
  posY?: number | null;
}

export interface ViewerFloor {
  id: number;
  level: number;
  imageUrl: string | null;
  width?: number | null;
  height?: number | null;
  professors: ViewerProfessor[];
  rooms?: ViewerRoom[];
}

/** 부모가 "지도에서 보기" 등으로 외부에서 특정 대상을 지목할 때 쓰는 명령. nonce로 재트리거. */
export interface FocusRequest {
  nonce: number;
  floorId: number;
  kind: "prof" | "room";
  id: number;
}

interface Props {
  floor: ViewerFloor;
  professors: ViewerProfessor[];
  /** 검색·층전환 대상이 되는 현재 건물의 전 층. */
  buildingFloors: ViewerFloor[];
  /** 다른 층 대상을 골랐을 때 부모에게 층 전환을 요청. */
  onRequestFloor: (floorId: number) => void;
  /** 외부(교수 탭)에서 들어오는 포커스 명령. */
  focusRequest?: FocusRequest | null;
  lang: "ko" | "en";
}

type SearchItem = {
  kind: "prof" | "room";
  id: number;
  floorId: number;
  level: number;
  nx: number;
  ny: number;
  label: string;
  sub: string;
  prof?: ViewerProfessor;
};

type Marker = { nx: number; ny: number };

const FOCUS_SCALE = 2.6;

export function FloorplanViewer({
  floor,
  professors,
  buildingFloors,
  onRequestFloor,
  focusRequest,
  lang,
}: Props) {
  const [selected, setSelected] = useState<ViewerProfessor | null>(null);
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [pinging, setPinging] = useState(false);

  const apiRef = useRef<ReactZoomPanPinchRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgBoxRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pendingRef = useRef<SearchItem | null>(null);
  const pingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pinned = professors.filter((p) => p.posX != null && p.posY != null);

  // 현재 건물 전 층의 검색 인덱스 (좌표 있는 항목만)
  const index = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    for (const f of buildingFloors) {
      for (const p of f.professors) {
        if (p.posX == null || p.posY == null) continue;
        items.push({
          kind: "prof",
          id: p.id,
          floorId: f.id,
          level: f.level,
          nx: p.posX,
          ny: p.posY,
          label: p.name,
          sub: p.roomNumber ? `${p.roomNumber}호` : "",
          prof: p,
        });
      }
      for (const r of f.rooms ?? []) {
        if (r.posX == null || r.posY == null) continue;
        items.push({
          kind: "room",
          id: r.id,
          floorId: f.id,
          level: f.level,
          nx: r.posX,
          ny: r.posY,
          label: `${r.code}호`,
          sub: r.name ?? "",
        });
      }
    }
    return items;
  }, [buildingFloors]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter((it) => it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q))
      .slice(0, 8);
  }, [index, query]);

  // 대상 중심으로 줌 + 펄스 마커.
  // 라이브러리의 애니메이션 setTransform 은 이 환경(Next/React)에서 불안정하므로
  // 즉시 setTransform(...,0) 으로 목표값을 확정하고, 부드러움은 콘텐츠 요소의 CSS transition 으로 준다
  // (transition 은 점프 동안만 켜고 끔 → 휠/드래그 조작감에는 영향 없음).
  function applyFocus(it: SearchItem) {
    const api = apiRef.current;
    const el = containerRef.current;
    const box = imgBoxRef.current;
    if (api && el && box) {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const s = FOCUS_SCALE;
      // 핀 좌표(%)는 이미지 박스 기준 → 컨테이너 안 레터박스 오프셋을 더해 콘텐츠 좌표로 변환.
      const px = W / 2 - s * (box.offsetLeft + it.nx * box.offsetWidth);
      const py = H / 2 - s * (box.offsetTop + it.ny * box.offsetHeight);
      const content = el.querySelector<HTMLElement>(".react-transform-component");
      if (content) {
        content.style.transition = "transform 0.5s cubic-bezier(0.22,1,0.36,1)";
        setTimeout(() => { content.style.transition = ""; }, 560);
      }
      api.setTransform(px, py, s, 0);
    }
    setMarker({ nx: it.nx, ny: it.ny });
    setPinging(true);
    if (pingTimer.current) clearTimeout(pingTimer.current);
    pingTimer.current = setTimeout(() => setPinging(false), 2400);
    if (it.kind === "prof" && it.prof) {
      const prof = it.prof;
      setTimeout(() => setSelected(prof), 520);
    } else {
      setSelected(null);
    }
  }

  // 대기 중 포커스를 "새 층 이미지 로드 완료 후" 적용 (로드 전엔 박스 크기가 stale).
  function tryApplyPending() {
    const p = pendingRef.current;
    if (!p || p.floorId !== floor.id) return;
    const img = imgRef.current;
    if (!img || !img.complete || !img.naturalWidth) return;
    pendingRef.current = null;
    setTimeout(() => applyFocus(p), 0);
  }

  // 대상 선택: 같은 층이면 바로, 다른 층이면 층 전환 요청 후 이미지 로드 시 적용.
  function goToTarget(it: SearchItem) {
    setQuery("");
    setOpen(false);
    if (it.floorId === floor.id) {
      applyFocus(it);
    } else {
      pendingRef.current = it;
      onRequestFloor(it.floorId);
    }
  }

  // 층 변경 시: 대기 중 포커스가 있으면 로드 후 적용, 없으면 transform 리셋.
  useEffect(() => {
    if (pendingRef.current && pendingRef.current.floorId === floor.id) {
      tryApplyPending();
      return;
    }
    apiRef.current?.resetTransform(0);
    setSelected(null);
    setMarker(null);
    setPinging(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id]);

  // 외부 포커스 명령(교수 탭 "지도에서 보기").
  useEffect(() => {
    if (!focusRequest) return;
    const it = index.find((x) => x.kind === focusRequest.kind && x.id === focusRequest.id);
    if (it) goToTarget(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  useEffect(() => () => { if (pingTimer.current) clearTimeout(pingTimer.current); }, []);

  if (!floor.imageUrl) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        {lang === "ko" ? "이 층의 평면도가 아직 업로드되지 않았습니다." : "The floor plan for this floor has not been uploaded yet."}
      </div>
    );
  }

  const aspect = imgAspect ?? (floor.width && floor.height ? floor.width / floor.height : 16 / 10);
  const hasTargets = index.some((it) => it.floorId === floor.id);

  return (
    <div className="relative w-full">
      {/* 검색 */}
      <div className="relative z-30 mb-3 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={lang === "ko" ? "교수명 · 호실 검색 (예: 김남일, 5112)" : "Search professor or room (e.g. 5112)"}
            enterKeyHint="search"
            className="w-full rounded-full border border-border bg-background/80 backdrop-blur pl-10 pr-10 py-2.5 text-base sm:text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
          />
          {query && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setQuery(""); setOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={lang === "ko" ? "검색 지우기" : "Clear search"}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {open && query.trim() && (
          <ul className="absolute left-0 right-0 mt-1.5 rounded-xl border border-border bg-popover premium-shadow-lg overflow-hidden">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                {lang === "ko" ? "검색 결과가 없습니다." : "No results."}
              </li>
            ) : (
              results.map((it) => (
                <li key={`${it.kind}-${it.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToTarget(it)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {it.kind === "prof" ? <User className="h-4 w-4" /> : <DoorClosed className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-sm truncate">{it.label}</span>
                      {it.sub && <span className="block text-xs text-muted-foreground truncate">{it.sub}</span>}
                    </span>
                    <Badge variant="secondary" className="shrink-0">{it.level}F</Badge>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-border relative mx-auto w-full h-[56vh] sm:h-[70vh] bg-gradient-to-br from-muted/60 via-background to-muted/30"
      >
        {/* 도면 뒤 은은한 엔지니어링 그리드 (CAD 청사진 느낌 대체) */}
        <div className="tech-mesh absolute inset-0 opacity-50 pointer-events-none" />
        <TransformWrapper
          ref={apiRef}
          minScale={1}
          maxScale={5}
          initialScale={1}
          centerOnInit
          limitToBounds
          centerZoomedOut
          doubleClick={{ mode: "zoomIn", step: 0.7 }}
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          panning={{ velocityDisabled: false }}
        >
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
            <div className="w-full h-full flex items-center justify-center">
              {/* 이미지 박스에 핀을 종속시켜 컨테이너 높이와 무관하게 좌표 정합 유지 */}
              <div ref={imgBoxRef} className="relative inline-block max-w-full max-h-full leading-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={floor.imageUrl}
                alt={`${floor.level}층 평면도`}
                style={{ aspectRatio: aspect }}
                className="block max-w-full max-h-full pointer-events-none select-none dark:invert dark:hue-rotate-180"
                draggable={false}
                onLoad={(e) => {
                  const t = e.currentTarget;
                  if (t.naturalWidth && t.naturalHeight) setImgAspect(t.naturalWidth / t.naturalHeight);
                  tryApplyPending();
                }}
              />
              {pinned.map((p) => {
                const active = selected?.id === p.id;
                const label = `${p.name}${p.roomNumber ? ` ${p.roomNumber}호` : ""}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={label}
                    className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-md border transition-all duration-300 ease-out ${
                      active
                        ? "z-20 bg-primary/20 border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/40"
                        : "z-10 bg-primary/10 border-primary/30 hover:z-30 hover:scale-105 hover:bg-primary/20 hover:border-primary/60 hover:shadow-md hover:shadow-primary/20"
                    }`}
                    style={{ left: `${(p.posX ?? 0) * 100}%`, top: `${(p.posY ?? 0) * 100}%`, width: "4.5%", height: "3%" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(p);
                    }}
                  >
                    <span
                      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-sm transition-transform duration-300 ${
                        active ? "scale-125" : "group-hover:scale-110"
                      }`}
                    />
                    <span
                      className={`pointer-events-none absolute left-1/2 bottom-full -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-full glass-premium px-2 py-0.5 text-xs font-semibold text-foreground transition-opacity duration-200 ${
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {p.roomNumber ? `${p.roomNumber}호 · ` : ""}
                      {p.name}
                    </span>
                  </button>
                );
              })}

              {/* 검색 포커스 마커 (교수·호실 공통) */}
              {marker && (
                <span
                  className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${marker.nx * 100}%`, top: `${marker.ny * 100}%` }}
                >
                  <span className="block h-5 w-5 rounded-full bg-accent/30 border-2 border-accent ring-2 ring-background shadow-lg" />
                  {pinging && (
                    <span className="absolute inset-0 rounded-full bg-accent/50 animate-ping" />
                  )}
                </span>
              )}
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* 안내 */}
      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
        {hasTargets ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-primary ring-2 ring-background shrink-0" />
            {lang === "ko"
              ? `연구실 ${pinned.length}곳 — 위에서 검색하거나 박스를 클릭하세요. 휠/핀치로 줌, 드래그로 이동.`
              : `${pinned.length} labs — search above or click a box. Wheel/pinch to zoom, drag to pan.`}
          </>
        ) : (
          lang === "ko"
            ? "이 층에는 등록된 연구실이 없습니다."
            : "No labs registered on this floor."
        )}
      </p>

      {/* 교수 정보 모달 */}
      {selected && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl premium-shadow-lg w-full sm:max-w-md p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 relative animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모바일 시트 그랩 핸들 */}
            <div className="sm:hidden mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            <button
              type="button"
              className="absolute top-3 right-3 -m-2 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(null)}
              aria-label={lang === "ko" ? "닫기" : "Close"}
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

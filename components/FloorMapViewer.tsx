"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, ExternalLink, User, Navigation, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import {
  parseGraph,
  buildAdjacency,
  findPath,
  pathToPolylinePoints,
  type GraphNode,
  type FloorGraph,
} from "@/lib/pathfinding";
import { sanitizeSvg, extractViewBox } from "@/lib/svg-parser";

interface ProfessorFull {
  id: number;
  name: string;
  nameEn: string | null;
  title: string;
  roomNumber: string | null;
  email: string | null;
  phone: string | null;
  researchArea: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
}

interface Room {
  id: string;
  polygon: [number, number][];
  label?: string;
}

interface RegionsData {
  rooms: Room[];
}

interface Props {
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  svgContent: string | null;       // 인라인 SVG (DWG/PDF 변환)
  regionsJson: string | null;
  graphJson: string | null;
  professors: ProfessorFull[];
  lang: "ko" | "en";
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonToPoints(polygon: [number, number][]): string {
  return polygon.map((p) => p.join(",")).join(" ");
}

export function FloorMapViewer({ imageUrl, imageWidth, imageHeight, svgContent, regionsJson, graphJson, professors, lang }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedProf, setSelectedProf] = useState<ProfessorFull | null>(null);
  const [pathFrom, setPathFrom] = useState("");
  const [pathTo, setPathTo] = useState("");
  const [activePath, setActivePath] = useState<string[] | null>(null);
  const [pathError, setPathError] = useState(false);

  // SVG content가 있으면 sanitize + viewBox 추출
  const sanitizedSvg = useMemo(() => {
    if (!svgContent) return null;
    return sanitizeSvg(svgContent);
  }, [svgContent]);

  const svgViewBox = useMemo(() => {
    if (!sanitizedSvg) return null;
    return extractViewBox(sanitizedSvg);
  }, [sanitizedSvg]);

  const regions = useMemo<RegionsData | null>(() => {
    if (!regionsJson) return null;
    try { return JSON.parse(regionsJson); } catch { return null; }
  }, [regionsJson]);

  const graph = useMemo<FloorGraph | null>(() => parseGraph(graphJson), [graphJson]);
  const adj = useMemo(() => (graph ? buildAdjacency(graph) : null), [graph]);

  // 교수 roomNumber 기반 빠른 조회
  const profByRoom = useMemo(() => {
    const map = new Map<string, ProfessorFull>();
    for (const p of professors) {
      if (p.roomNumber) map.set(p.roomNumber, p);
    }
    return map;
  }, [professors]);

  // 길찾기 가능한 방 목록
  const navigableRooms = useMemo<GraphNode[]>(() => {
    if (!graph) return [];
    return graph.nodes.filter(
      (n) => n.label || profByRoom.has(n.id)
    );
  }, [graph, profByRoom]);

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !regions) return;
    const { x, y } = getSvgPoint(svgRef.current, e.clientX, e.clientY);
    for (const room of regions.rooms) {
      if (pointInPolygon([x, y], room.polygon)) {
        const prof = profByRoom.get(room.id);
        if (prof) setSelectedProf(prof);
        return;
      }
    }
  }

  function handleFindPath() {
    setPathError(false);
    setActivePath(null);
    if (!graph || !adj || !pathFrom || !pathTo || pathFrom === pathTo) return;
    const result = findPath(graph, pathFrom, pathTo, adj);
    if (result) {
      setActivePath(result);
    } else {
      setPathError(true);
    }
  }

  const polylinePoints = useMemo(() => {
    if (!activePath || !graph) return "";
    return pathToPolylinePoints(activePath, graph.nodes);
  }, [activePath, graph]);

  const arrowMarkerId = "floor-map-arrow";

  return (
    <div className="space-y-4">
      {/* 지도 뷰어 */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
        <TransformWrapper
          initialScale={1}
          minScale={0.3}
          maxScale={8}
          limitToBounds={false}
          panning={{ excluded: ["svg-room"] }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* 줌 컨트롤 */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                <button
                  onClick={() => zoomIn()}
                  className="w-8 h-8 rounded-lg bg-background/90 border border-border shadow flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => zoomOut()}
                  className="w-8 h-8 rounded-lg bg-background/90 border border-border shadow flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => resetTransform()}
                  className="w-8 h-8 rounded-lg bg-background/90 border border-border shadow flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              <TransformComponent
                wrapperStyle={{ width: "100%", display: "block" }}
                contentStyle={{ width: "100%" }}
              >
                <div className="relative w-full">
                  {/* 평면도: SVG 인라인 우선, 없으면 이미지 fallback */}
                  {sanitizedSvg && svgViewBox ? (
                    <div
                      className="w-full block select-none [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                      style={{ maxWidth: "100%" }}
                      dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
                    />
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="평면도"
                      className="w-full h-auto block select-none"
                      draggable={false}
                      style={{ maxWidth: "100%" }}
                    />
                  ) : null}

                  {/* SVG 인터랙션 오버레이 — viewBox는 평면도 SVG와 일치 */}
                  {regions && (
                    <svg
                      ref={svgRef}
                      className="absolute inset-0"
                      style={{ width: "100%", height: "100%" }}
                      viewBox={svgViewBox
                        ? `${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`
                        : `0 0 ${imageWidth} ${imageHeight}`}
                      preserveAspectRatio="xMidYMid meet"
                      onClick={handleSvgClick}
                    >
                      <defs>
                        <marker
                          id={arrowMarkerId}
                          markerWidth="8"
                          markerHeight="8"
                          refX="6"
                          refY="3"
                          orient="auto"
                        >
                          <path d="M0,0 L0,6 L8,3 z" fill="var(--color-primary)" />
                        </marker>
                      </defs>

                      {/* 방 폴리곤 */}
                      {regions.rooms.map((room) => {
                        const hasProf = profByRoom.has(room.id);
                        return (
                          <polygon
                            key={room.id}
                            className={hasProf ? "svg-room" : ""}
                            points={polygonToPoints(room.polygon)}
                            fill={hasProf ? "var(--color-primary)" : "transparent"}
                            fillOpacity={hasProf ? 0.25 : 0}
                            stroke={hasProf ? "var(--color-primary)" : "transparent"}
                            strokeWidth={hasProf ? 2 : 0}
                            style={{ cursor: hasProf ? "pointer" : "default" }}
                          />
                        );
                      })}

                      {/* 활성 경로 오버레이 */}
                      {activePath && polylinePoints && (
                        <polyline
                          points={polylinePoints}
                          fill="none"
                          stroke="var(--color-primary)"
                          strokeWidth="4"
                          strokeDasharray="12 6"
                          strokeLinecap="round"
                          markerEnd={`url(#${arrowMarkerId})`}
                          className="animate-dash"
                          style={{ pointerEvents: "none" }}
                        />
                      )}

                      {/* 경로 노드 표시 (출발/도착) */}
                      {activePath && graph && [activePath[0], activePath[activePath.length - 1]].map((nodeId, idx) => {
                        const node = graph.nodes.find((n) => n.id === nodeId);
                        if (!node) return null;
                        return (
                          <circle
                            key={nodeId + idx}
                            cx={node.x}
                            cy={node.y}
                            r={idx === 0 ? 10 : 12}
                            fill={idx === 0 ? "var(--color-primary)" : "oklch(0.72 0.18 200)"}
                            stroke="white"
                            strokeWidth="3"
                            style={{ pointerEvents: "none" }}
                          />
                        );
                      })}
                    </svg>
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {/* 길찾기 패널 */}
      {graph && navigableRooms.length >= 2 && (
        <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            {lang === "ko" ? "길 찾기" : "Navigation"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{lang === "ko" ? "출발" : "From"}</label>
              <select
                value={pathFrom}
                onChange={(e) => { setPathFrom(e.target.value); setActivePath(null); setPathError(false); }}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{lang === "ko" ? "선택..." : "Select..."}</option>
                {navigableRooms.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label ?? n.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{lang === "ko" ? "목적지" : "To"}</label>
              <select
                value={pathTo}
                onChange={(e) => { setPathTo(e.target.value); setActivePath(null); setPathError(false); }}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{lang === "ko" ? "선택..." : "Select..."}</option>
                {navigableRooms.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label ?? n.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-2"
              onClick={handleFindPath}
              disabled={!pathFrom || !pathTo || pathFrom === pathTo}
            >
              <Navigation className="h-4 w-4" />
              {lang === "ko" ? "길 찾기" : "Find Route"}
            </Button>
            {activePath && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setActivePath(null); setPathFrom(""); setPathTo(""); }}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                {lang === "ko" ? "초기화" : "Clear"}
              </Button>
            )}
          </div>
          {pathError && (
            <p className="text-xs text-destructive">
              {lang === "ko" ? "경로를 찾을 수 없습니다." : "No route found."}
            </p>
          )}
          {activePath && (
            <p className="text-xs text-muted-foreground">
              {lang === "ko"
                ? `경로: ${activePath.length - 1}개 구간`
                : `Route: ${activePath.length - 1} segment(s)`}
            </p>
          )}
        </div>
      )}

      {/* 교수 정보 팝업 */}
      <Dialog open={!!selectedProf} onOpenChange={() => setSelectedProf(null)}>
        <DialogContent className="max-w-sm">
          {selectedProf && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProf.imageUrl ? (
                    <Image
                      src={selectedProf.imageUrl}
                      alt={selectedProf.name}
                      width={48}
                      height={48}
                      className="rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight">{selectedProf.name} {selectedProf.title}</p>
                    {selectedProf.roomNumber && (
                      <Badge variant="outline" className="text-xs mt-0.5">{selectedProf.roomNumber}호</Badge>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {selectedProf.researchArea && (
                  <p className="text-sm text-muted-foreground">{selectedProf.researchArea}</p>
                )}
                <div className="space-y-2">
                  {selectedProf.email && (
                    <a
                      href={`mailto:${selectedProf.email}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{selectedProf.email}</span>
                    </a>
                  )}
                  {selectedProf.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{selectedProf.phone}</span>
                    </div>
                  )}
                  {selectedProf.websiteUrl && (
                    <a
                      href={selectedProf.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">{lang === "ko" ? "웹사이트" : "Website"}</span>
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

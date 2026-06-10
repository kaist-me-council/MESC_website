"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, Upload, Save, Trash2, Plus, Link2, MousePointer, Map, FileCode, Sparkles
} from "lucide-react";
import { polygonCentroid } from "@/lib/pathfinding";
import { detectRoomsAndFacilities, detectedRoomsToRegions, sanitizeSvg, extractViewBox, svgToDataUri } from "@/lib/svg-parser";

/* ─────────── 타입 ─────────── */
interface Room {
  id: string;
  polygon: [number, number][];
  label?: string;
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
  label?: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface FloorMeta {
  level: number;
  building: { code: string; name: string };
}

interface Props {
  floorId: number;
  floorMeta: FloorMeta;
  initialImageUrl: string | null;
  initialImageWidth: number | null;
  initialImageHeight: number | null;
  initialSvgContent: string | null;
  initialRegionsJson: string | null;
  initialGraphJson: string | null;
  professors: Array<{ id: number; name: string; roomNumber: string | null }>;
}

/* ─────────── SVG 좌표 변환 ─────────── */
function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return [0, 0];
  const { x, y } = pt.matrixTransform(ctm.inverse());
  return [Math.round(x), Math.round(y)];
}

function dist2d(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function parseRegions(json: string | null): Room[] {
  if (!json) return [];
  try { return JSON.parse(json).rooms ?? []; } catch { return []; }
}

function parseGraph(json: string | null): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!json) return { nodes: [], edges: [] };
  try {
    const d = JSON.parse(json);
    return { nodes: d.nodes ?? [], edges: d.edges ?? [] };
  } catch { return { nodes: [], edges: [] }; }
}

/* ─────────── 컴포넌트 ─────────── */
export default function FloorMapEditor({
  floorId, floorMeta,
  initialImageUrl, initialImageWidth, initialImageHeight,
  initialSvgContent,
  initialRegionsJson, initialGraphJson,
  professors,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const svgFileRef = useRef<HTMLInputElement>(null);

  // 이미지
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [imgW, setImgW] = useState(initialImageWidth ?? 0);
  const [imgH, setImgH] = useState(initialImageHeight ?? 0);
  const [uploading, setUploading] = useState(false);

  // SVG 인라인 콘텐츠 (DWG/PDF 변환)
  const [svgContent, setSvgContent] = useState(initialSvgContent ?? "");
  const [svgLoading, setSvgLoading] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);

  // 탭
  const [tab, setTab] = useState<"rooms" | "graph">("rooms");

  // 방 영역 state
  const [rooms, setRooms] = useState<Room[]>(parseRegions(initialRegionsJson));
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState("");
  const [pendingRoomLabel, setPendingRoomLabel] = useState("");

  // 그래프 state
  const [nodes, setNodes] = useState<GraphNode[]>(parseGraph(initialGraphJson).nodes);
  const [edges, setEdges] = useState<GraphEdge[]>(parseGraph(initialGraphJson).edges);
  const [graphMode, setGraphMode] = useState<"node" | "edge">("node");
  const [edgeStart, setEdgeStart] = useState<string | null>(null);

  // 저장
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // 변경 감지
  useEffect(() => { setDirty(true); }, [rooms, nodes, edges, imageUrl, svgContent]);

  // 이탈 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /* ── 이미지 업로드 ── */
  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setImageUrl(data.url);
      if (data.width) setImgW(data.width);
      if (data.height) setImgH(data.height);
    } else {
      alert(data.error ?? "업로드 실패");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  /* ── SVG 파일 인라인 업로드 (DWG/PDF 변환된 SVG) ── */
  async function loadSvgFile(file: File) {
    setSvgLoading(true);
    try {
      const text = await file.text();
      const sanitized = sanitizeSvg(text);
      const viewBox = extractViewBox(sanitized);

      setSvgContent(sanitized);

      // viewBox로 자연 크기 자동 설정
      if (viewBox) {
        setImgW(Math.round(viewBox.w));
        setImgH(Math.round(viewBox.h));
      }

      // imageUrl 비우기 (SVG가 우선)
      // setImageUrl("");  // 기존 PNG도 fallback으로 남겨둘 수 있음
    } catch (e) {
      alert("SVG 파일 읽기 실패: " + (e as Error).message);
    }
    setSvgLoading(false);
    if (svgFileRef.current) svgFileRef.current.value = "";
  }

  /* ── 호실 자동 감지 ── */
  function autoDetectRooms() {
    if (!svgContent) {
      alert("먼저 SVG 파일을 업로드하세요.");
      return;
    }
    setAutoDetecting(true);
    try {
      const result = detectRoomsAndFacilities(svgContent);

      if (result.rooms.length === 0) {
        alert("호실번호 텍스트를 찾지 못했습니다.\n(SVG의 <text> 요소 중 4자리 숫자 패턴 검색)");
        setAutoDetecting(false);
        return;
      }

      // viewBox 갱신
      if (result.viewBox) {
        setImgW(Math.round(result.viewBox.w));
        setImgH(Math.round(result.viewBox.h));
      }

      // 자동 감지된 호실 → regionsJson 자동 생성
      const auto = detectedRoomsToRegions(result.rooms);

      // 기존 rooms 중 같은 id는 유지 (admin 수정사항 보존), 새 호실만 추가
      const existingIds = new Set(rooms.map((r) => r.id));
      const newRooms = auto.rooms.filter((r) => !existingIds.has(r.id));

      const merged = [...rooms, ...newRooms];
      setRooms(merged);

      // 시설(계단/엘베 등)을 graph node로 자동 추가
      const facilityNodes = result.facilities.map((f, i) => ({
        id: `${f.type}_${i + 1}`,
        x: Math.round(f.x),
        y: Math.round(f.y),
        label: f.label,
      }));
      const existingNodeIds = new Set(nodes.map((n) => n.id));
      const newNodes = facilityNodes.filter((n) => !existingNodeIds.has(n.id));
      if (newNodes.length > 0) {
        setNodes([...nodes, ...newNodes]);
      }

      alert(
        `자동 감지 완료!\n` +
        `호실: 총 ${result.rooms.length}개 중 ${newRooms.length}개 신규 추가\n` +
        `시설: ${result.facilities.length}개 감지, ${newNodes.length}개 신규 노드`
      );
    } catch (e) {
      alert("감지 중 오류: " + (e as Error).message);
    }
    setAutoDetecting(false);
  }

  /* ── SVG 클릭 핸들러 ── */
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const [x, y] = getSvgPoint(svgRef.current, e.clientX, e.clientY);

    if (tab === "rooms") {
      if (!drawing) return;
      // 첫 점 근처 클릭 → 다각형 닫기
      if (drawPoints.length >= 3 && dist2d([x, y], drawPoints[0]) < 15) {
        finishPolygon();
        return;
      }
      setDrawPoints((prev) => [...prev, [x, y]]);
      return;
    }

    if (tab === "graph") {
      if (graphMode === "node") {
        // 빈 곳 클릭 → waypoint 추가
        const n = nodes.length + 1;
        const newNode: GraphNode = { id: `wp_${n}`, x, y, label: `복도 ${n}` };
        setNodes((prev) => [...prev, newNode]);
      }
    }
  }, [tab, drawing, drawPoints, graphMode, nodes]);

  const handleSvgDoubleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tab === "rooms" && drawing && drawPoints.length >= 3) {
      e.preventDefault();
      finishPolygon();
    }
  }, [tab, drawing, drawPoints]);

  function finishPolygon() {
    if (drawPoints.length < 3) return;
    const id = prompt("호실 번호를 입력하세요 (예: 3301):");
    if (!id?.trim()) { setDrawPoints([]); setDrawing(false); return; }
    const label = prompt("라벨 (선택, 예: 3301호):", `${id.trim()}호`) ?? `${id.trim()}호`;
    const newRoom: Room = {
      id: id.trim(),
      polygon: [...drawPoints],
      label: label.trim() || undefined,
    };
    setRooms((prev) => [...prev.filter((r) => r.id !== newRoom.id), newRoom]);
    setDrawPoints([]);
    setDrawing(false);
  }

  /* ── 방 폴리곤 클릭 ── */
  function handleRoomClick(roomId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (tab === "rooms") {
      setSelectedRoomId(roomId);
      const r = rooms.find((r) => r.id === roomId);
      setPendingRoomId(r?.id ?? "");
      setPendingRoomLabel(r?.label ?? "");
    }
    if (tab === "graph" && graphMode === "node") {
      // 방 클릭 → 해당 방의 room node 추가
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      if (nodes.find((n) => n.id === roomId)) return; // 이미 있으면 무시
      const [cx, cy] = polygonCentroid(room.polygon);
      setNodes((prev) => [...prev, { id: roomId, x: cx, y: cy, label: room.label ?? roomId }]);
    }
  }

  /* ── 그래프 노드 클릭 ── */
  function handleNodeClick(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (tab !== "graph" || graphMode !== "edge") return;
    if (!edgeStart) {
      setEdgeStart(nodeId);
    } else {
      if (edgeStart !== nodeId) {
        setEdges((prev) => [...prev, { from: edgeStart, to: nodeId }]);
      }
      setEdgeStart(null);
    }
  }

  /* ── 엣지 삭제 ── */
  function deleteEdge(idx: number) {
    if (confirm("이 엣지를 삭제할까요?")) {
      setEdges((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  /* ── 방 삭제 ── */
  function deleteRoom(id: string) {
    if (confirm(`방 "${id}"을 삭제할까요?`)) {
      setRooms((prev) => prev.filter((r) => r.id !== id));
      // 연결된 그래프 노드/엣지도 제거
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
      if (selectedRoomId === id) setSelectedRoomId(null);
    }
  }

  /* ── 노드 삭제 ── */
  function deleteNode(id: string) {
    if (confirm(`노드 "${id}"을 삭제할까요?`)) {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
      if (edgeStart === id) setEdgeStart(null);
    }
  }

  /* ── 저장 ── */
  async function saveAll() {
    setSaving(true);
    setSaveMsg("");
    const regionsJson = rooms.length > 0 ? JSON.stringify({ rooms }) : null;
    const graphJson = (nodes.length > 0 || edges.length > 0)
      ? JSON.stringify({ nodes, edges })
      : null;

    const res = await fetch(`/api/buildings/floors/${floorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: imageUrl || null,
        imageWidth: imgW || null,
        imageHeight: imgH || null,
        svgContent: svgContent || null,
        regionsJson,
        graphJson,
      }),
    });
    if (res.ok) {
      setDirty(false);
      setSaveMsg("저장 완료!");
      setTimeout(() => setSaveMsg(""), 2000);
    } else {
      setSaveMsg("저장 실패");
    }
    setSaving(false);
  }

  /* ── 폴리곤 포인트 문자열 ── */
  function toPoints(polygon: [number, number][]): string {
    return polygon.map((p) => p.join(",")).join(" ");
  }

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="flex h-full gap-0">
      {/* ── 사이드바 ── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-background overflow-y-auto">
        {/* 탭 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => { setTab("rooms"); setDrawing(false); setDrawPoints([]); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === "rooms" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Map className="inline h-4 w-4 mr-1.5" />방 영역
          </button>
          <button
            onClick={() => { setTab("graph"); setDrawing(false); setDrawPoints([]); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === "graph" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Navigation className="inline h-4 w-4 mr-1.5" />경로 그래프
          </button>
        </div>

        <div className="p-4 flex-1 space-y-4">
          {/* ── 방 영역 탭 ── */}
          {tab === "rooms" && (
            <>
              <Button
                size="sm"
                className="w-full gap-2"
                variant={drawing ? "destructive" : "default"}
                onClick={() => {
                  if (drawing) { setDrawing(false); setDrawPoints([]); }
                  else { setDrawing(true); setDrawPoints([]); setSelectedRoomId(null); }
                }}
              >
                {drawing ? <><X className="h-4 w-4" />그리기 취소</> : <><Plus className="h-4 w-4" />새 방 그리기</>}
              </Button>

              {drawing && (
                <Alert>
                  <AlertDescription className="text-xs">
                    캔버스를 클릭해 꼭짓점을 추가하세요.<br />
                    첫 번째 점 근처 클릭 또는 더블클릭으로 완료.
                    ({drawPoints.length}개 점)
                  </AlertDescription>
                </Alert>
              )}

              {/* 방 목록 */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">방 목록 ({rooms.length})</p>
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setPendingRoomId(room.id);
                      setPendingRoomLabel(room.label ?? "");
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${selectedRoomId === room.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    <span className="font-medium truncate">{room.label ?? room.id}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                      className="text-destructive hover:opacity-70 ml-2 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 선택된 방 편집 */}
              {selectedRoom && (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <p className="text-xs font-semibold">선택된 방 편집</p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">호실 번호</Label>
                      <Input
                        value={pendingRoomId}
                        onChange={(e) => setPendingRoomId(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="3301"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">라벨 (선택)</Label>
                      <Input
                        value={pendingRoomLabel}
                        onChange={(e) => setPendingRoomLabel(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="3301호"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => {
                        if (!pendingRoomId.trim()) return;
                        setRooms((prev) => prev.map((r) =>
                          r.id === selectedRoomId
                            ? { ...r, id: pendingRoomId.trim(), label: pendingRoomLabel.trim() || undefined }
                            : r
                        ));
                        setSelectedRoomId(pendingRoomId.trim());
                      }}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 그래프 탭 ── */}
          {tab === "graph" && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">모드</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={graphMode === "node" ? "default" : "outline"}
                    onClick={() => { setGraphMode("node"); setEdgeStart(null); }}
                    className="text-xs gap-1"
                  >
                    <MousePointer className="h-3.5 w-3.5" />노드 추가
                  </Button>
                  <Button
                    size="sm"
                    variant={graphMode === "edge" ? "default" : "outline"}
                    onClick={() => { setGraphMode("edge"); }}
                    className="text-xs gap-1"
                  >
                    <Link2 className="h-3.5 w-3.5" />엣지 연결
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  {graphMode === "node"
                    ? "빈 곳 클릭 → 복도 waypoint 추가\n방 폴리곤 클릭 → 방 노드 추가"
                    : edgeStart
                    ? `출발: ${edgeStart} → 두 번째 노드 클릭`
                    : "연결할 첫 번째 노드를 클릭"}
                </AlertDescription>
              </Alert>

              {/* 노드 목록 */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">노드 ({nodes.length})</p>
                {nodes.map((n) => (
                  <div key={n.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${edgeStart === n.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                    <span className="font-medium">{n.label ?? n.id}</span>
                    <span className="text-muted-foreground mr-2">({n.x},{n.y})</span>
                    <button onClick={() => deleteNode(n.id)} className="text-destructive hover:opacity-70">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 엣지 목록 */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">엣지 ({edges.length})</p>
                {edges.map((e, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs hover:bg-muted">
                    <span>{e.from} → {e.to}</span>
                    <button onClick={() => deleteEdge(idx)} className="text-destructive hover:opacity-70">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 캔버스 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 캔버스 툴바 */}
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 bg-muted/20 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => svgFileRef.current?.click()}
              disabled={svgLoading}
              className="gap-2 text-xs"
              title="DWG/PDF에서 변환한 SVG 업로드 (벡터, 자동 호실 감지 가능)"
            >
              {svgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
              SVG 업로드
            </Button>
            <input
              ref={svgFileRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadSvgFile(f); }}
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-2 text-xs"
              title="PNG/JPG 평면도 업로드 (raster fallback)"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              이미지 업로드
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
            />

            {svgContent && (
              <Button
                size="sm"
                variant="default"
                onClick={autoDetectRooms}
                disabled={autoDetecting}
                className="gap-2 text-xs"
              >
                {autoDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                호실 자동 감지
              </Button>
            )}

            {(imageUrl || svgContent) && (
              <span className="text-xs text-muted-foreground">
                {svgContent ? "📄 SVG" : "🖼️ PNG"} · {imgW}×{imgH}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {saveMsg && <span className="text-xs text-primary font-semibold">{saveMsg}</span>}
            {dirty && <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">미저장 변경사항</Badge>}
            <Button size="sm" onClick={saveAll} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </Button>
          </div>
        </div>

        {/* 실제 캔버스 */}
        <div className="flex-1 overflow-auto bg-muted/10 flex items-start justify-center p-4">
          {!imageUrl && !svgContent ? (
            <div className="w-full max-w-2xl flex flex-col gap-3">
              <div
                onClick={() => svgFileRef.current?.click()}
                className="h-32 rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <FileCode className="h-8 w-8 text-primary/70" />
                <p className="text-sm font-semibold">SVG 업로드 (추천)</p>
                <p className="text-xs text-muted-foreground">DWG/PDF에서 변환한 SVG · 호실 자동 감지 가능</p>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                className="h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/30 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">또는 PNG/JPG 이미지 업로드</p>
              </div>
            </div>
          ) : imgW === 0 ? (
            <p className="text-muted-foreground text-sm">이미지/SVG 크기 정보 없음. 다시 업로드해주세요.</p>
          ) : (
            <div className="relative inline-block" style={{ maxWidth: "100%" }}>
              {svgContent ? (
                <img
                  src={svgToDataUri(sanitizeSvg(svgContent))}
                  alt="평면도"
                  className="block select-none max-w-full h-auto"
                  draggable={false}
                  style={{ maxWidth: "100%" }}
                />
              ) : (
                <img
                  src={imageUrl}
                  alt="평면도"
                  className="block select-none"
                  draggable={false}
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              )}
              <svg
                ref={svgRef}
                className="absolute inset-0"
                style={{
                  width: "100%",
                  height: "100%",
                  cursor: drawing ? "crosshair" : tab === "graph" ? "pointer" : "default",
                }}
                viewBox={`0 0 ${imgW} ${imgH}`}
                preserveAspectRatio="xMidYMid meet"
                onClick={handleSvgClick}
                onDoubleClick={handleSvgDoubleClick}
              >
                {/* 방 폴리곤 */}
                {rooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  const hasNode = nodes.some((n) => n.id === room.id);
                  return (
                    <g key={room.id}>
                      <polygon
                        points={toPoints(room.polygon)}
                        fill={isSelected ? "var(--color-primary)" : "var(--color-primary)"}
                        fillOpacity={isSelected ? 0.35 : 0.15}
                        stroke="var(--color-primary)"
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => handleRoomClick(room.id, e)}
                      />
                      {/* 방 라벨 */}
                      <text
                        x={polygonCentroid(room.polygon)[0]}
                        y={polygonCentroid(room.polygon)[1]}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={Math.max(10, Math.min(imgW, imgH) * 0.02)}
                        fill="var(--color-primary)"
                        fontWeight="bold"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {room.label ?? room.id}
                        {hasNode && " ●"}
                      </text>
                    </g>
                  );
                })}

                {/* 그리는 중인 다각형 */}
                {drawing && drawPoints.length > 0 && (
                  <>
                    <polyline
                      points={drawPoints.map((p) => p.join(",")).join(" ")}
                      fill="none"
                      stroke="orange"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                    {drawPoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={p[0]}
                        cy={p[1]}
                        r={i === 0 ? 7 : 4}
                        fill={i === 0 ? "orange" : "white"}
                        stroke="orange"
                        strokeWidth="2"
                        style={{ pointerEvents: i === 0 ? "auto" : "none", cursor: i === 0 ? "pointer" : "default" }}
                        onClick={i === 0 ? (e) => { e.stopPropagation(); if (drawPoints.length >= 3) finishPolygon(); } : undefined}
                      />
                    ))}
                  </>
                )}

                {/* 그래프 엣지 */}
                {tab === "graph" && edges.map((edge, idx) => {
                  const from = nodes.find((n) => n.id === edge.from);
                  const to = nodes.find((n) => n.id === edge.to);
                  if (!from || !to) return null;
                  return (
                    <line
                      key={idx}
                      x1={from.x} y1={from.y}
                      x2={to.x} y2={to.y}
                      stroke="oklch(0.72 0.18 200)"
                      strokeWidth="2"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); deleteEdge(idx); }}
                    />
                  );
                })}

                {/* 그래프 노드 */}
                {tab === "graph" && nodes.map((node) => {
                  const isRoom = rooms.some((r) => r.id === node.id);
                  const isEdgeStart = edgeStart === node.id;
                  return (
                    <g key={node.id} style={{ cursor: graphMode === "edge" ? "pointer" : "default" }}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isEdgeStart ? 12 : 8}
                        fill={isRoom ? "var(--color-primary)" : "oklch(0.72 0.18 200)"}
                        stroke={isEdgeStart ? "white" : "transparent"}
                        strokeWidth="3"
                        onClick={(e) => handleNodeClick(node.id, e)}
                      />
                      <text
                        x={node.x}
                        y={node.y + 18}
                        textAnchor="middle"
                        fontSize="10"
                        fill="var(--color-foreground)"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {node.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Navigation icon fallback (not imported from lucide to avoid conflict)
function Navigation({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
